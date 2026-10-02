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
            val pendingIntent = PendingIntent.getBroadcast(context, 1001, intent, flags)

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

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    // Use inexact scheduling by default to respect Android battery and Doze policies.
                    // 09:00 local time is the intended reminder time; inexact AlarmManager delivery
                    // may be delayed by Android power-management policies.
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                } else {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                }
                Log.d(TAG, "Document reminder alarm scheduled for ~09:00 local time (inexact)")
            } catch (e: Exception) {
                try {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                } catch (fallbackErr: Exception) {
                    Log.w(TAG, "Failed to schedule alarm: ${fallbackErr.message}")
                }
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
            val pendingIntent = PendingIntent.getBroadcast(context, 1001, intent, flags)
            alarmManager.cancel(pendingIntent)
            Log.d(TAG, "Document reminder alarm cancelled")
        }

        private fun findDatabaseFile(context: Context): File? {
            val candidatePaths = listOf(
                File(context.filesDir, "vault.sqlite"),
                File(context.filesDir, "com.royalrohan.veylock/vault.sqlite"),
                File(context.noBackupFilesDir, "vault.sqlite"),
                File(context.getDatabasePath("vault.sqlite").path),
                File(context.applicationInfo.dataDir, "files/vault.sqlite")
            )
            return candidatePaths.firstOrNull { it.exists() }
        }

        fun checkAndDeliver(context: Context): Int {
            createNotificationChannel(context)

            // Check notification permission on Android 13+ (API 33+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val hasPermission = ContextCompat.checkSelfPermission(
                    context,
                    android.Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
                if (!hasPermission) {
                    Log.d(TAG, "Notification permission not granted, skipping delivery")
                    return 0
                }
            }

            val dbFile = findDatabaseFile(context)
            if (dbFile == null || !dbFile.exists()) {
                Log.d(TAG, "vault.sqlite not found in standard paths, skipping delivery")
                return 0
            }

            var deliveredCount = 0
            var db: SQLiteDatabase? = null
            try {
                db = SQLiteDatabase.openDatabase(dbFile.absolutePath, null, SQLiteDatabase.OPEN_READWRITE)

                // Check if document reminders are enabled in vault_metadata
                val metaCursor = db.rawQuery(
                    "SELECT value FROM vault_metadata WHERE key = 'document_reminders_enabled'",
                    null
                )
                var remindersGloballyEnabled = true
                if (metaCursor.moveToFirst()) {
                    val valStr = metaCursor.getString(0)
                    remindersGloballyEnabled = valStr != "0"
                }
                metaCursor.close()

                if (!remindersGloballyEnabled) {
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

                val cursor = db.rawQuery(
                    "SELECT id, title, expiry_date, reminder_enabled, last_reminder_milestone, last_reminder_date FROM documents WHERE reminder_enabled = 1 AND expiry_date IS NOT NULL AND expiry_date != ''",
                    null
                )

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
                    val diffDays = (diffMillis / (1000L * 60 * 60 * 24)).toInt()

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
                Log.w(TAG, "Error evaluating document reminders: ${e.message}")
            } finally {
                db?.close()
            }

            return deliveredCount
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_DATE_CHANGED,
            ACTION_CHECK_REMINDERS -> {
                Log.d(TAG, "DocumentReminderReceiver triggered with action: ${intent.action}")
                checkAndDeliver(context)
                scheduleDailyAlarm(context)
            }
        }
    }
}
