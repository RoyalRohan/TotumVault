use rusqlite::{params, Connection};
use std::path::Path;

pub fn init_db(db_path: &Path) -> Result<Connection, String> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create DB directory: {}", e))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700));
        }
    }

    let conn = Connection::open(db_path).map_err(|e| format!("Failed to open SQLite DB: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if db_path.exists() {
            let _ = std::fs::set_permissions(db_path, std::fs::Permissions::from_mode(0o600));
        }
    }

    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        PRAGMA synchronous = NORMAL;

        CREATE TABLE IF NOT EXISTS vault_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS entries (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL DEFAULT 'logins',
            is_favorite INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_used_at TEXT,
            nonce_b64 TEXT NOT NULL,
            encrypted_payload_b64 TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            doc_type TEXT NOT NULL DEFAULT 'other',
            description TEXT NOT NULL DEFAULT '',
            tags TEXT NOT NULL DEFAULT '[]',
            document_date TEXT,
            expiry_date TEXT,
            is_favorite INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS document_pages (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            page_number INTEGER NOT NULL DEFAULT 1,
            mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
            width INTEGER NOT NULL DEFAULT 0,
            height INTEGER NOT NULL DEFAULT 0,
            file_size INTEGER NOT NULL DEFAULT 0,
            nonce_b64 TEXT NOT NULL,
            encrypted_blob_b64 TEXT NOT NULL,
            thumbnail_nonce_b64 TEXT,
            thumbnail_blob_b64 TEXT,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category);
        CREATE INDEX IF NOT EXISTS idx_documents_fav ON documents(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_doc_pages_doc_id ON document_pages(document_id, page_number);
        ",
    )
    .map_err(|e| format!("Failed to initialize DB schema: {}", e))?;

    Ok(conn)
}

pub fn save_metadata(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO vault_metadata (key, value) VALUES (?1, ?2)",
        params![key, value],
    )
    .map_err(|e| format!("Failed to save metadata key '{}': {}", key, e))?;
    Ok(())
}

pub fn get_metadata(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare("SELECT value FROM vault_metadata WHERE key = ?1")
        .map_err(|e| format!("Failed to prepare metadata query: {}", e))?;

    let mut rows = stmt
        .query(params![key])
        .map_err(|e| format!("Failed to query metadata: {}", e))?;

    if let Some(row) = rows.next().map_err(|e| format!("Error fetching row: {}", e))? {
        let val: String = row.get(0).map_err(|e| format!("Error getting column: {}", e))?;
        Ok(Some(val))
    } else {
        Ok(None)
    }
}

#[allow(clippy::too_many_arguments)]
pub fn save_encrypted_entry(
    conn: &Connection,
    id: &str,
    category: &str,
    favorite: bool,
    created_at: &str,
    updated_at: &str,
    last_used_at: Option<&str>,
    nonce_b64: &str,
    encrypted_payload_b64: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO entries 
        (id, category, is_favorite, created_at, updated_at, last_used_at, nonce_b64, encrypted_payload_b64) 
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            category,
            if favorite { 1 } else { 0 },
            created_at,
            updated_at,
            last_used_at,
            nonce_b64,
            encrypted_payload_b64
        ],
    )
    .map_err(|e| format!("Failed to save encrypted entry record: {}", e))?;
    Ok(())
}

pub struct RawDbEntryRecord {
    pub id: String,
    pub category: String,
    pub is_favorite: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_used_at: Option<String>,
    pub nonce_b64: String,
    pub encrypted_payload_b64: String,
}

pub fn get_all_encrypted_entries(conn: &Connection) -> Result<Vec<RawDbEntryRecord>, String> {
    let mut stmt = conn
        .prepare("SELECT id, category, is_favorite, created_at, updated_at, last_used_at, nonce_b64, encrypted_payload_b64 FROM entries")
        .map_err(|e| format!("Failed to prepare entries query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let fav_int: i32 = row.get(2)?;
            Ok(RawDbEntryRecord {
                id: row.get(0)?,
                category: row.get(1)?,
                is_favorite: fav_int != 0,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                last_used_at: row.get(5)?,
                nonce_b64: row.get(6)?,
                encrypted_payload_b64: row.get(7)?,
            })
        })
        .map_err(|e| format!("Error executing entries query: {}", e))?;

    let mut records = Vec::new();
    for r in rows {
        records.push(r.map_err(|e| format!("Error mapping entry row: {}", e))?);
    }
    Ok(records)
}

pub fn delete_entry_record(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM entries WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete entry: {}", e))?;
    Ok(())
}

pub fn wipe_all_entries(conn: &Connection) -> Result<(), String> {
    conn.execute("DELETE FROM entries", [])
        .map_err(|e| format!("Failed to wipe entries table: {}", e))?;
    Ok(())
}

#[derive(Debug, Clone)]
pub struct RawDbDocumentRecord {
    pub id: String,
    pub title: String,
    pub doc_type: String,
    pub description: String,
    pub tags: String,
    pub document_date: Option<String>,
    pub expiry_date: Option<String>,
    pub is_favorite: bool,
    pub created_at: String,
    pub updated_at: String,
    pub page_count: usize,
    pub first_page_thumbnail_nonce: Option<String>,
    pub first_page_thumbnail_blob: Option<String>,
}

#[allow(clippy::too_many_arguments)]
pub fn save_document_record(
    conn: &Connection,
    id: &str,
    title: &str,
    doc_type: &str,
    description: &str,
    tags: &str,
    document_date: Option<&str>,
    expiry_date: Option<&str>,
    favorite: bool,
    created_at: &str,
    updated_at: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO documents 
        (id, title, doc_type, description, tags, document_date, expiry_date, is_favorite, created_at, updated_at) 
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            id,
            title,
            doc_type,
            description,
            tags,
            document_date,
            expiry_date,
            if favorite { 1 } else { 0 },
            created_at,
            updated_at,
        ],
    )
    .map_err(|e| format!("Failed to save document record: {}", e))?;
    Ok(())
}

pub fn get_all_documents(conn: &Connection) -> Result<Vec<RawDbDocumentRecord>, String> {
    // Join with document_pages to get page count and first page thumbnail
    let mut stmt = conn
        .prepare(
            "SELECT d.id, d.title, d.doc_type, d.description, d.tags, d.document_date, d.expiry_date, 
                    d.is_favorite, d.created_at, d.updated_at,
                    (SELECT COUNT(*) FROM document_pages WHERE document_id = d.id) as page_count,
                    p.thumbnail_nonce_b64, p.thumbnail_blob_b64
             FROM documents d
             LEFT JOIN document_pages p ON p.document_id = d.id AND p.page_number = 1
             ORDER BY d.updated_at DESC"
        )
        .map_err(|e| format!("Failed to prepare documents query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let fav_int: i32 = row.get(7)?;
            let page_count_i: i64 = row.get(10)?;
            Ok(RawDbDocumentRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                doc_type: row.get(2)?,
                description: row.get(3)?,
                tags: row.get(4)?,
                document_date: row.get(5)?,
                expiry_date: row.get(6)?,
                is_favorite: fav_int != 0,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
                page_count: page_count_i as usize,
                first_page_thumbnail_nonce: row.get(11)?,
                first_page_thumbnail_blob: row.get(12)?,
            })
        })
        .map_err(|e| format!("Error executing documents query: {}", e))?;

    let mut records = Vec::new();
    for r in rows {
        records.push(r.map_err(|e| format!("Error mapping document row: {}", e))?);
    }
    Ok(records)
}

pub fn get_document_record(conn: &Connection, id: &str) -> Result<Option<RawDbDocumentRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT d.id, d.title, d.doc_type, d.description, d.tags, d.document_date, d.expiry_date, 
                    d.is_favorite, d.created_at, d.updated_at,
                    (SELECT COUNT(*) FROM document_pages WHERE document_id = d.id) as page_count,
                    p.thumbnail_nonce_b64, p.thumbnail_blob_b64
             FROM documents d
             LEFT JOIN document_pages p ON p.document_id = d.id AND p.page_number = 1
             WHERE d.id = ?1"
        )
        .map_err(|e| format!("Failed to prepare get_document query: {}", e))?;

    let mut rows = stmt
        .query(params![id])
        .map_err(|e| format!("Failed to query document: {}", e))?;

    if let Some(row) = rows.next().map_err(|e| format!("Error fetching document row: {}", e))? {
        let fav_int: i32 = row.get(7).map_err(|e| format!("Error getting fav: {}", e))?;
        let page_count_i: i64 = row.get(10).map_err(|e| format!("Error getting count: {}", e))?;
        Ok(Some(RawDbDocumentRecord {
            id: row.get(0).map_err(|e| format!("Error getting id: {}", e))?,
            title: row.get(1).map_err(|e| format!("Error getting title: {}", e))?,
            doc_type: row.get(2).map_err(|e| format!("Error getting doc_type: {}", e))?,
            description: row.get(3).map_err(|e| format!("Error getting description: {}", e))?,
            tags: row.get(4).map_err(|e| format!("Error getting tags: {}", e))?,
            document_date: row.get(5).map_err(|e| format!("Error getting doc_date: {}", e))?,
            expiry_date: row.get(6).map_err(|e| format!("Error getting exp_date: {}", e))?,
            is_favorite: fav_int != 0,
            created_at: row.get(8).map_err(|e| format!("Error getting created_at: {}", e))?,
            updated_at: row.get(9).map_err(|e| format!("Error getting updated_at: {}", e))?,
            page_count: page_count_i as usize,
            first_page_thumbnail_nonce: row.get(11).map_err(|e| format!("Error getting thumb nonce: {}", e))?,
            first_page_thumbnail_blob: row.get(12).map_err(|e| format!("Error getting thumb blob: {}", e))?,
        }))
    } else {
        Ok(None)
    }
}

pub fn delete_document_record(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM document_pages WHERE document_id = ?1", params![id])
        .map_err(|e| format!("Failed to delete document pages: {}", e))?;
    conn.execute("DELETE FROM documents WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete document: {}", e))?;
    Ok(())
}

pub fn toggle_document_favorite_record(conn: &Connection, id: &str) -> Result<bool, String> {
    let mut stmt = conn
        .prepare("SELECT is_favorite FROM documents WHERE id = ?1")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;
    let mut rows = stmt
        .query(params![id])
        .map_err(|e| format!("Failed to query favorite: {}", e))?;

    if let Some(row) = rows.next().map_err(|e| format!("Row error: {}", e))? {
        let current: i32 = row.get(0).map_err(|e| format!("Col error: {}", e))?;
        let next_val = if current == 0 { 1 } else { 0 };
        conn.execute("UPDATE documents SET is_favorite = ?1, updated_at = ?2 WHERE id = ?3",
            params![next_val, chrono::Utc::now().to_rfc3339(), id])
            .map_err(|e| format!("Failed to update favorite: {}", e))?;
        Ok(next_val == 1)
    } else {
        Err("Document not found".to_string())
    }
}

#[derive(Debug, Clone)]
pub struct RawDbDocumentPageRecord {
    pub id: String,
    pub document_id: String,
    pub page_number: usize,
    pub mime_type: String,
    pub width: u32,
    pub height: u32,
    pub file_size: usize,
    pub nonce_b64: String,
    pub encrypted_blob_b64: String,
    pub thumbnail_nonce_b64: Option<String>,
    pub thumbnail_blob_b64: Option<String>,
    pub created_at: String,
}

#[allow(clippy::too_many_arguments)]
pub fn save_document_page_record(
    conn: &Connection,
    id: &str,
    document_id: &str,
    page_number: usize,
    mime_type: &str,
    width: u32,
    height: u32,
    file_size: usize,
    nonce_b64: &str,
    encrypted_blob_b64: &str,
    thumbnail_nonce_b64: Option<&str>,
    thumbnail_blob_b64: Option<&str>,
    created_at: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO document_pages 
        (id, document_id, page_number, mime_type, width, height, file_size, nonce_b64, encrypted_blob_b64, thumbnail_nonce_b64, thumbnail_blob_b64, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            id,
            document_id,
            page_number as i64,
            mime_type,
            width as i64,
            height as i64,
            file_size as i64,
            nonce_b64,
            encrypted_blob_b64,
            thumbnail_nonce_b64,
            thumbnail_blob_b64,
            created_at,
        ],
    )
    .map_err(|e| format!("Failed to save document page record: {}", e))?;
    Ok(())
}

pub fn get_document_pages_by_doc_id(conn: &Connection, document_id: &str) -> Result<Vec<RawDbDocumentPageRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, document_id, page_number, mime_type, width, height, file_size, 
                    nonce_b64, encrypted_blob_b64, thumbnail_nonce_b64, thumbnail_blob_b64, created_at
             FROM document_pages 
             WHERE document_id = ?1 
             ORDER BY page_number ASC"
        )
        .map_err(|e| format!("Failed to prepare pages query: {}", e))?;

    let rows = stmt
        .query_map(params![document_id], |row| {
            let page_num: i64 = row.get(2)?;
            let width: i64 = row.get(4)?;
            let height: i64 = row.get(5)?;
            let file_size: i64 = row.get(6)?;
            Ok(RawDbDocumentPageRecord {
                id: row.get(0)?,
                document_id: row.get(1)?,
                page_number: page_num as usize,
                mime_type: row.get(3)?,
                width: width as u32,
                height: height as u32,
                file_size: file_size as usize,
                nonce_b64: row.get(7)?,
                encrypted_blob_b64: row.get(8)?,
                thumbnail_nonce_b64: row.get(9)?,
                thumbnail_blob_b64: row.get(10)?,
                created_at: row.get(11)?,
            })
        })
        .map_err(|e| format!("Error executing pages query: {}", e))?;

    let mut records = Vec::new();
    for r in rows {
        records.push(r.map_err(|e| format!("Error mapping page row: {}", e))?);
    }
    Ok(records)
}

pub fn get_document_page_record(conn: &Connection, page_id: &str) -> Result<Option<RawDbDocumentPageRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, document_id, page_number, mime_type, width, height, file_size, 
                    nonce_b64, encrypted_blob_b64, thumbnail_nonce_b64, thumbnail_blob_b64, created_at
             FROM document_pages 
             WHERE id = ?1"
        )
        .map_err(|e| format!("Failed to prepare page query: {}", e))?;

    let mut rows = stmt
        .query(params![page_id])
        .map_err(|e| format!("Failed to query page: {}", e))?;

    if let Some(row) = rows.next().map_err(|e| format!("Error fetching page row: {}", e))? {
        let page_num: i64 = row.get(2).map_err(|e| format!("Error: {}", e))?;
        let width: i64 = row.get(4).map_err(|e| format!("Error: {}", e))?;
        let height: i64 = row.get(5).map_err(|e| format!("Error: {}", e))?;
        let file_size: i64 = row.get(6).map_err(|e| format!("Error: {}", e))?;
        Ok(Some(RawDbDocumentPageRecord {
            id: row.get(0).map_err(|e| format!("Error: {}", e))?,
            document_id: row.get(1).map_err(|e| format!("Error: {}", e))?,
            page_number: page_num as usize,
            mime_type: row.get(3).map_err(|e| format!("Error: {}", e))?,
            width: width as u32,
            height: height as u32,
            file_size: file_size as usize,
            nonce_b64: row.get(7).map_err(|e| format!("Error: {}", e))?,
            encrypted_blob_b64: row.get(8).map_err(|e| format!("Error: {}", e))?,
            thumbnail_nonce_b64: row.get(9).map_err(|e| format!("Error: {}", e))?,
            thumbnail_blob_b64: row.get(10).map_err(|e| format!("Error: {}", e))?,
            created_at: row.get(11).map_err(|e| format!("Error: {}", e))?,
        }))
    } else {
        Ok(None)
    }
}

pub fn delete_document_page_record(conn: &Connection, page_id: &str) -> Result<String, String> {
    let page = get_document_page_record(conn, page_id)?
        .ok_or_else(|| "Page not found".to_string())?;
    let doc_id = page.document_id.clone();

    conn.execute("DELETE FROM document_pages WHERE id = ?1", params![page_id])
        .map_err(|e| format!("Failed to delete page: {}", e))?;

    // Re-sequence remaining pages for this document
    let remaining = get_document_pages_by_doc_id(conn, &doc_id)?;
    for (idx, p) in remaining.iter().enumerate() {
        let new_num = (idx + 1) as i64;
        conn.execute("UPDATE document_pages SET page_number = ?1 WHERE id = ?2", params![new_num, p.id])
            .map_err(|e| format!("Failed to reorder page: {}", e))?;
    }

    // Update document updated_at
    conn.execute("UPDATE documents SET updated_at = ?1 WHERE id = ?2", params![chrono::Utc::now().to_rfc3339(), doc_id])
        .map_err(|e| format!("Failed to update document timestamp: {}", e))?;

    Ok(doc_id)
}

pub fn reorder_pages_record(conn: &Connection, document_id: &str, page_ids: &[String]) -> Result<(), String> {
    for (idx, pid) in page_ids.iter().enumerate() {
        let new_num = (idx + 1) as i64;
        conn.execute(
            "UPDATE document_pages SET page_number = ?1 WHERE id = ?2 AND document_id = ?3",
            params![new_num, pid, document_id],
        )
        .map_err(|e| format!("Failed to update page order: {}", e))?;
    }
    conn.execute("UPDATE documents SET updated_at = ?1 WHERE id = ?2", params![chrono::Utc::now().to_rfc3339(), document_id])
        .map_err(|e| format!("Failed to update document timestamp: {}", e))?;
    Ok(())
}

pub fn wipe_all_documents(conn: &Connection) -> Result<(), String> {
    conn.execute("DELETE FROM document_pages", [])
        .map_err(|e| format!("Failed to wipe document_pages table: {}", e))?;
    conn.execute("DELETE FROM documents", [])
        .map_err(|e| format!("Failed to wipe documents table: {}", e))?;
    Ok(())
}

