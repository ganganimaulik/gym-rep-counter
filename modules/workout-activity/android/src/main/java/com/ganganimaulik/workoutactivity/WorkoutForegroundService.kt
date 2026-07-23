package com.ganganimaulik.workoutactivity

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.CountDownTimer
import android.os.IBinder
import androidx.core.app.NotificationCompat

class WorkoutForegroundService : Service() {

    private val CHANNEL_ID = "workout_channel"
    private val NOTIFICATION_ID = 888

    private var exerciseName = ""
    private var nextExerciseName = ""
    private var currentSet = 1
    private var totalSets = 1
    private var reps = 0
    private var currentRep = 0
    private var phase = ""
    private var isResting = false
    private var isPaused = false
    private var restSeconds = 0
    private var pausedRemainingSeconds = 0
    private var restStartTimestamp: Double = 0.0

    private var countDownTimer: CountDownTimer? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) return START_NOT_STICKY

        val action = intent.action
        if (action == "STOP_WORKOUT_ACTIVITY") {
            stopTimer()
            stopForeground(true)
            stopSelf()
            return START_NOT_STICKY
        }

        exerciseName = intent.getStringExtra("exerciseName") ?: ""
        nextExerciseName = intent.getStringExtra("nextExerciseName") ?: ""
        currentSet = intent.getIntExtra("currentSet", 1)
        totalSets = intent.getIntExtra("totalSets", 1)
        reps = intent.getIntExtra("reps", 0)
        currentRep = intent.getIntExtra("currentRep", 0)
        phase = intent.getStringExtra("phase") ?: ""
        isResting = intent.getBooleanExtra("isResting", false)
        isPaused = intent.getBooleanExtra("isPaused", false)
        restSeconds = intent.getIntExtra("restSeconds", 0)
        pausedRemainingSeconds = intent.getIntExtra("pausedRemainingSeconds", 0)
        restStartTimestamp = intent.getDoubleExtra("restStartTimestamp", 0.0)

        // Start Foreground Service with initial notification
        val initialRemainingSec = if (isPaused) pausedRemainingSeconds else restSeconds
        val notification = buildNotification(isResting, if (isResting) initialRemainingSec else 0)
        startForeground(NOTIFICATION_ID, notification)

        if (isResting && restSeconds > 0 && !isPaused) {
            startTimer()
        } else {
            stopTimer()
        }

        return START_STICKY
    }

    private fun startTimer() {
        stopTimer()

        val totalMs = restSeconds * 1000L
        val elapsedMs = System.currentTimeMillis() - restStartTimestamp.toLong()
        val remainingMs = totalMs - elapsedMs

        if (remainingMs <= 0) {
            updateNotificationRestComplete()
            return
        }

        countDownTimer = object : CountDownTimer(remainingMs, 500) {
            override fun onTick(millisUntilFinished: Long) {
                val remainingSec = (millisUntilFinished / 1000).toInt()
                val notification = buildNotification(true, remainingSec)
                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.notify(NOTIFICATION_ID, notification)
            }

            override fun onFinish() {
                updateNotificationRestComplete()
            }
        }.start()
    }

    private fun stopTimer() {
        countDownTimer?.cancel()
        countDownTimer = null
    }

    private fun updateNotificationRestComplete() {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        try {
            val mainActivityClass = Class.forName("com.ganganimaulik.repcounterapp.MainActivity")
            val notificationIntent = Intent(this, mainActivityClass)
            val pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )

            val builder = NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Rest Complete!")
                .setContentText("Get ready for Set $currentSet of $exerciseName")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .setProgress(0, 0, false)
                .setPriority(NotificationCompat.PRIORITY_HIGH)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                builder.setCategory(Notification.CATEGORY_SERVICE)
            }

            notificationManager.notify(NOTIFICATION_ID, builder.build())
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun buildNotification(resting: Boolean, remainingSec: Int): Notification {
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setOngoing(true)
            .setSmallIcon(android.R.drawable.ic_dialog_info)

        try {
            val mainActivityClass = Class.forName("com.ganganimaulik.repcounterapp.MainActivity")
            val notificationIntent = Intent(this, mainActivityClass)
            val pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            builder.setContentIntent(pendingIntent)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        if (resting) {
            val title = if (isPaused) {
                "Resting (Paused): ${remainingSec}s remaining"
            } else {
                "Resting: ${remainingSec}s remaining"
            }
            builder.setContentTitle(title)
            builder.setContentText("Next: ${if (nextExerciseName.isEmpty()) "None" else nextExerciseName} (Set $currentSet/$totalSets)")
            builder.setProgress(restSeconds, remainingSec, false)
            builder.setPriority(NotificationCompat.PRIORITY_LOW)
        } else {
            val title = if (isPaused) {
                "Active (Paused): $exerciseName"
            } else {
                "Active: $exerciseName"
            }
            builder.setContentTitle(title)
            builder.setContentText("Set $currentSet of $totalSets • Rep $currentRep of $reps")
            builder.setProgress(0, 0, false)
            builder.setPriority(NotificationCompat.PRIORITY_HIGH)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            builder.setCategory(Notification.CATEGORY_SERVICE)
        }

        return builder.build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Workout Updates"
            val descriptionText = "Displays ongoing rest timers and active exercise details."
            val importance = NotificationManager.IMPORTANCE_DEFAULT
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                setSound(null, null)
                enableLights(false)
                enableVibration(false)
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        stopTimer()
        super.onDestroy()
    }
}
