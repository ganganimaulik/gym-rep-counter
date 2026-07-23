package com.ganganimaulik.workoutactivity

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WorkoutActivityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WorkoutActivityModule")

    Function("startActivity") { data: Map<String, Any> ->
      sendIntent("START_WORKOUT_ACTIVITY", data)
    }

    Function("updateActivity") { data: Map<String, Any> ->
      sendIntent("UPDATE_WORKOUT_ACTIVITY", data)
    }

    Function("stopActivity") {
      val context = appContext.reactContext ?: return@Function null
      try {
        val serviceClass = Class.forName("com.ganganimaulik.workoutactivity.WorkoutForegroundService")
        val intent = Intent(context, serviceClass).apply {
          action = "STOP_WORKOUT_ACTIVITY"
        }
        context.stopService(intent)
      } catch (e: Exception) {
        e.printStackTrace()
      }
      null
    }
  }

  private fun sendIntent(actionStr: String, data: Map<String, Any>) {
    val context = appContext.reactContext ?: return
    try {
      val serviceClass = Class.forName("com.ganganimaulik.workoutactivity.WorkoutForegroundService")
      val intent = Intent(context, serviceClass).apply {
        action = actionStr
        putExtra("exerciseName", data["exerciseName"] as? String ?: "")
        putExtra("nextExerciseName", data["nextExerciseName"] as? String ?: "")
        putExtra("currentSet", (data["currentSet"] as? Number)?.toInt() ?: 1)
        putExtra("totalSets", (data["totalSets"] as? Number)?.toInt() ?: 1)
        putExtra("reps", (data["reps"] as? Number)?.toInt() ?: 0)
        putExtra("currentRep", (data["currentRep"] as? Number)?.toInt() ?: 0)
        putExtra("phase", data["phase"] as? String ?: "")
        putExtra("isResting", data["isResting"] as? Boolean ?: false)
        putExtra("isPaused", data["isPaused"] as? Boolean ?: false)
        putExtra("restSeconds", (data["restSeconds"] as? Number)?.toInt() ?: 0)
        putExtra("pausedRemainingSeconds", (data["pausedRemainingSeconds"] as? Number)?.toInt() ?: 0)
        putExtra("restStartTimestamp", (data["restStartTimestamp"] as? Number)?.toDouble() ?: System.currentTimeMillis().toDouble())
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }
}
