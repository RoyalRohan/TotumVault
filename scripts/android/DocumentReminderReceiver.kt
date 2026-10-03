package com.royalrohan.veylock

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.sqlite.SQLiteDatabase
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class DocumentReminderReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "DocumentReminder"
        const val CHANNEL_ID = "document_reminders"
        const val CHANNEL_NAME = "Document Reminders"
        const val ACTION_CHECK_REMINDERS = "com.royalrohan.veylock.CHECK_DOCUMENT_REMINDERS"
        const val REQUEST_CODE_DAILY = 1001
        const val REQUEST_CODE_TEST = 1002
        const val NOTIFICATION_ID_TEST_ALARM = 9998

        fun createNotificationChannel(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                    val channel = NotificationChannel(
                        CHANNEL_ID,
                        CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_DEFAULT
                    ).apply {
                        description = "TotumVault document renewal and expiry reminders"
                    }
                    nm.createNotificationChannel(channel)
                    Log.d(TAG, "REMINDER: Notification channel '$CHANNEL_ID' created")
                }
            }
        }

        fun scheduleDailyAlarm(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, DocumentReminderReceiver::class.java).apply {
                action = ACTION_CHECK_REMINDERS
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getBroadcast(context, REQUEST_CODE_DAILY, intent, flags)

            // Calculate next 09:00 local time
            val cal = Calendar.getInstance().apply {
                timeInMillis = System.currentTimeMillis()
                set(Calendar.HOUR_OF_DAY, 9)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }

            // If 09:00 has already passed today, advance to tomorrow 09:00
            if (cal.timeInMillis <= System.currentTimeMillis()) {
                cal.add(Calendar.DAY_OF_YEAR, 1)
            }

            val triggerAtMillis = cal.timeInMillis
            val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).apply {
                timeZone = TimeZone.getDefault()
            }
            val targetStr = sdf.format(Date(triggerAtMillis))

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    // Inexact scheduling by default to respect Android battery and Doze policies.
                    // 09:00 local time is the intended reminder time; inexact AlarmManager delivery
                    // may be delayed by Android power-management policies.
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                } else {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                }
                Log.d(TAG, "REMINDER: Daily alarm scheduled for $targetStr (${TimeZone.getDefault().id}, requestCode=$REQUEST_CODE_DAILY)")
            } catch (e: Exception) {
                try {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                    Log.d(TAG, "REMINDER: Fallback alarm set for $targetStr")
                } catch (fallbackErr: Exception) {
                    Log.w(TAG, "REMINDER: Failed to schedule alarm: ${fallbackErr.message}")
                }
            }
        }

        fun scheduleTestAlarm(context: Context, delaySeconds: Int = 30) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, DocumentReminderReceiver::class.java).apply {
                action = ACTION_CHECK_REMINDERS
                putExtra("is_test_alarm", true)
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getBroadcast(context, REQUEST_CODE_TEST, intent, flags)
            val triggerAtMillis = System.currentTimeMillis() + (delaySeconds * 1000L)

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                } else {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                }
                Log.d(TAG, "REMINDER: 30-second test alarm registered for +${delaySeconds}s (triggerAt: $triggerAtMillis, requestCode=$REQUEST_CODE_TEST)")
            } catch (e: Exception) {
                Log.w(TAG, "REMINDER: Failed to schedule test alarm: ${e.message}")
            }
        }

        fun cancelDailyAlarm(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, DocumentReminderReceiver::class.java).apply {
                action = ACTION_CHECK_REMINDERS
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getBroadcast(context, REQUEST_CODE_DAILY, intent, flags)
            alarmManager.cancel(pendingIntent)
            Log.d(TAG, "REMINDER: Daily reminder alarm cancelled")
        }

        private fun findVaultSqliteRecursive(dir: File, currentDepth: Int, maxDepth: Int): File? {
            if (currentDepth > maxDepth || !dir.exists() || !dir.isDirectory) return null
            val files = dir.listFiles() ?: return null
            for (file in files) {
                if (file.name == "cache" || file.name == "code_cache") continue
                if (file.isFile && file.name == "vault.sqlite" && file.length() > 0) {
                    return file
                }
                if (file.isDirectory) {
                    val nested = findVaultSqliteRecursive(file, currentDepth + 1, maxDepth)
                    if (nested != null) return nested
                }
            }
            return null
        }

        fun findDatabaseFile(context: Context): File? {
            val candidates = mutableListOf<File>()

            // 1. Android Context dataDir (API 24+) - where Tauri v2 app_data_dir resolves
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                try {
                    val dDir = context.dataDir
                    candidates.add(File(dDir, "vault.sqlite"))
                    candidates.add(File(dDir, "totumvault_data/vault.sqlite"))
                    candidates.add(File(dDir, "TotumVault/vault.sqlite"))
                    candidates.add(File(dDir, "com.royalrohan.veylock/vault.sqlite"))
                } catch (_: Exception) {}
            }

            // 2. applicationInfo.dataDir
            try {
                val appDataDir = context.applicationInfo.dataDir
                if (!appDataDir.isNullOrBlank()) {
                    val base = File(appDataDir)
                    candidates.add(File(base, "vault.sqlite"))
                    candidates.add(File(base, "files/vault.sqlite"))
                    candidates.add(File(base, "totumvault_data/vault.sqlite"))
                    candidates.add(File(base, "databases/vault.sqlite"))
                    candidates.add(File(base, "com.royalrohan.veylock/vault.sqlite"))
                }
            } catch (_: Exception) {}

            // 3. Context filesDir & subdirectories
            try {
                candidates.add(File(context.filesDir, "vault.sqlite"))
                candidates.add(File(context.filesDir, "com.royalrohan.veylock/vault.sqlite"))
                candidates.add(File(context.filesDir, "totumvault_data/vault.sqlite"))
            } catch (_: Exception) {}

            // 4. noBackupFilesDir & standard database path
            try {
                candidates.add(File(context.noBackupFilesDir, "vault.sqlite"))
                candidates.add(File(context.getDatabasePath("vault.sqlite").path))
            } catch (_: Exception) {}

            // Check candidate files in prioritized order
            for (candidate in candidates) {
                try {
                    if (candidate.exists() && candidate.isFile && candidate.length() > 0) {
                        Log.d(TAG, "REMINDER: Database located at candidate path: ${candidate.absolutePath} (size: ${candidate.length()} bytes)")
                        return candidate
                    }
                } catch (_: Exception) {}
            }

            // 5. Fallback: Shallow recursive search of app's data directory
            try {
                val rootDir = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    context.dataDir
                } else {
                    val appDataDir = context.applicationInfo.dataDir
                    if (!appDataDir.isNullOrBlank()) File(appDataDir) else context.filesDir.parentFile
                }
                if (rootDir != null && rootDir.exists() && rootDir.isDirectory) {
                    val found = findVaultSqliteRecursive(rootDir, 0, 3)
                    if (found != null) {
                        Log.d(TAG, "REMINDER: Database discovered via directory scan: ${found.absolutePath} (size: ${found.length()} bytes)")
                        return found
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "REMINDER: Directory scan exception: ${e.message}")
            }

            Log.w(TAG, "REMINDER: vault.sqlite not found in any standard paths or subdirectories")
            return null
        }

        fun sendTestAlarmConfirmationNotification(context: Context) {
            try {
                createNotificationChannel(context)
                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
                val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    putExtra("route", "documents")
                }
                val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_UPDATE_CURRENT
                }
                val contentPendingIntent = if (launchIntent != null) {
                    PendingIntent.getActivity(context, NOTIFICATION_ID_TEST_ALARM, launchIntent, piFlags)
                } else null

                val notif = NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle("TotumVault")
                    .setContentText("Scheduled background alarm verified: AlarmManager and Receiver are functional.")
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setAutoCancel(true)
                    .apply {
                        if (contentPendingIntent != null) {
                            setContentIntent(contentPendingIntent)
                        }
                    }
                    .build()

                nm.notify(NOTIFICATION_ID_TEST_ALARM, notif)
                Log.d(TAG, "REMINDER: Dispatched test alarm confirmation notification (id: $NOTIFICATION_ID_TEST_ALARM)")
            } catch (e: Exception) {
                Log.w(TAG, "REMINDER: Failed to dispatch test alarm confirmation: ${e.message}")
            }
        }

        fun checkAndDeliver(context: Context): Int {
            Log.d(TAG, "REMINDER: checkAndDeliver invoked")
            createNotificationChannel(context)

            // Check notification permission on Android 13+ (API 33+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val hasPermission = ContextCompat.checkSelfPermission(
                    context,
                    android.Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
                if (!hasPermission) {
                    Log.d(TAG, "REMINDER: Notification permission not granted, skipping delivery")
                    return 0
                }
            }

            val dbFile = findDatabaseFile(context)
            if (dbFile == null || !dbFile.exists()) {
                Log.d(TAG, "REMINDER: vault.sqlite not found, skipping delivery")
                return 0
            }

            var deliveredCount = 0
            var db: SQLiteDatabase? = null
            try {
                // Open database with WRITE_AHEAD_LOGGING support to prevent locks against Rust WAL
                val openFlags = SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING
                db = SQLiteDatabase.openDatabase(dbFile.absolutePath, null, openFlags)

                // Check if document reminders are enabled in vault_metadata
                var remindersGloballyEnabled = true
                try {
                    val metaCursor = db.rawQuery(
                        "SELECT value FROM vault_metadata WHERE key = 'document_reminders_enabled'",
                        null
                    )
                    if (metaCursor.moveToFirst()) {
                        val valStr = metaCursor.getString(0)
                        remindersGloballyEnabled = valStr != "0"
                    }
                    metaCursor.close()
                } catch (e: Exception) {
                    Log.d(TAG, "REMINDER: vault_metadata query note: ${e.message}")
                }

                if (!remindersGloballyEnabled) {
                    Log.d(TAG, "REMINDER: Reminders globally disabled in vault_metadata, cancelling alarm")
                    cancelDailyAlarm(context)
                    return 0
                }

                val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                    timeZone = TimeZone.getDefault()
                }
                val today = Date()
                val todayStr = sdf.format(today)
                val todayCal = Calendar.getInstance().apply {
                    time = today
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }

                Log.d(TAG, "REMINDER: Evaluating due documents for local date $todayStr")

                val cursor = db.rawQuery(
                    "SELECT id, title, expiry_date, reminder_enabled, last_reminder_milestone, last_reminder_date FROM documents WHERE reminder_enabled = 1 AND expiry_date IS NOT NULL AND expiry_date != ''",
                    null
                )

                Log.d(TAG, "REMINDER: Found ${cursor.count} document(s) with reminder_enabled=1 and expiry_date set")

                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager

                while (cursor.moveToNext()) {
                    val docId = cursor.getString(0)
                    val title = cursor.getString(1)
                    val expiryStr = cursor.getString(2)
                    val reminderEnabled = cursor.getInt(3) == 1
                    val lastMilestone = if (cursor.isNull(4)) null else cursor.getInt(4)
                    val lastDate = if (cursor.isNull(5)) null else cursor.getString(5)

                    if (!reminderEnabled || expiryStr.isNullOrBlank()) continue

                    val expiryDate: Date
                    try {
                        expiryDate = sdf.parse(expiryStr.trim()) ?: continue
                    } catch (_: Exception) {
                        continue
                    }

                    val expiryCal = Calendar.getInstance().apply {
                        time = expiryDate
                        set(Calendar.HOUR_OF_DAY, 0)
                        set(Calendar.MINUTE, 0)
                        set(Calendar.SECOND, 0)
                        set(Calendar.MILLISECOND, 0)
                    }

                    val diffMillis = expiryCal.timeInMillis - todayCal.timeInMillis
                    // Use Math.round to handle DST transitions (e.g. 23 or 25 hour days) robustly
                    val diffDays = Math.round(diffMillis.toDouble() / (1000.0 * 60.0 * 60.0 * 24.0)).toInt()

                    val milestone: Int? = when (diffDays) {
                        5 -> 5
                        4 -> 4
                        3 -> 3
                        2 -> 2
                        1 -> 1
                        0 -> 0
                        in Int.MIN_VALUE..-1 -> -1
                        else -> null
                    }

                    val maskedDocId = if (docId.length > 8) docId.substring(0, 8) + "..." else docId
                    Log.d(TAG, "REMINDER: docId=$maskedDocId diffDays=$diffDays milestone=$milestone lastMilestone=$lastMilestone lastDate=$lastDate")

                    if (milestone == null) continue

                    // If already expired, only deliver once
                    if (diffDays < -1 && lastMilestone == -1) continue

                    // Suppress duplicate on same day
                    if (lastDate == todayStr) continue

                    // Suppress if milestone already delivered
                    if (lastMilestone == milestone) continue

                    val docTitle = if (title.isNullOrBlank()) "A document" else title

                    // Privacy-safe message: Only document title and countdown
                    val message = when (milestone) {
                        5 -> "$docTitle expires in 5 days."
                        4 -> "$docTitle expires in 4 days."
                        3 -> "$docTitle expires in 3 days."
                        2 -> "$docTitle expires in 2 days."
                        1 -> "$docTitle expires tomorrow."
                        0 -> "$docTitle expires today."
                        else -> "$docTitle has expired."
                    }

                    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        putExtra("route", "documents")
                        putExtra("doc_id", docId)
                    }
                    val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    } else {
                        PendingIntent.FLAG_UPDATE_CURRENT
                    }
                    val contentPendingIntent = if (launchIntent != null) {
                        PendingIntent.getActivity(context, docId.hashCode(), launchIntent, piFlags)
                    } else null

                    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentTitle("TotumVault")
                        .setContentText(message)
                        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                        .setAutoCancel(true)
                        .apply {
                            if (contentPendingIntent != null) {
                                setContentIntent(contentPendingIntent)
                            }
                        }
                        .build()

                    nm?.notify(docId.hashCode(), notification)
                    deliveredCount++
                    Log.d(TAG, "REMINDER: Notification dispatched for docId=$maskedDocId (milestone: $milestone)")

                    val updateStmt = db.compileStatement(
                        "UPDATE documents SET last_reminder_milestone = ?, last_reminder_date = ? WHERE id = ?"
                    )
                    updateStmt.bindLong(1, milestone.toLong())
                    updateStmt.bindString(2, todayStr)
                    updateStmt.bindString(3, docId)
                    updateStmt.executeUpdateDelete()
                    updateStmt.close()
                }

                cursor.close()
            } catch (e: Exception) {
                Log.w(TAG, "REMINDER: Error evaluating document reminders: ${e.message}")
            } finally {
                try {
                    db?.close()
                } catch (_: Exception) {}
            }

            Log.d(TAG, "REMINDER: checkAndDeliver completed. Delivered count: $deliveredCount")
            return deliveredCount
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val isTestAlarm = intent.getBooleanExtra("is_test_alarm", false)
        Log.d(TAG, "REMINDER: onReceive triggered. action=${intent.action}, is_test_alarm=$isTestAlarm")

        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_DATE_CHANGED,
            ACTION_CHECK_REMINDERS -> {
                val deliveredCount = checkAndDeliver(context)
                if (isTestAlarm && deliveredCount == 0) {
                    // Test alarm verification: if no real documents are currently due, dispatch
                    // confirmation so user can immediately verify the AlarmManager -> Receiver pipeline.
                    sendTestAlarmConfirmationNotification(context)
                }
                scheduleDailyAlarm(context)
            }
            else -> {
                Log.d(TAG, "REMINDER: Unhandled action: ${intent.action}")
            }
        }
    }
}
