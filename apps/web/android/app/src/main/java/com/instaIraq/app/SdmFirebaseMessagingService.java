package com.instaIraq.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class SdmFirebaseMessagingService extends FirebaseMessagingService {
    private static final String CALL_CHANNEL = "sdm_calls";
    private static final String GENERAL_CHANNEL = "sdm_general";

    @Override public void onNewToken(String token) {}

    @Override public void onMessageReceived(RemoteMessage message) {
        Map<String,String> data=message.getData();
        String type=data.get("type"), title=data.get("title"), body=data.get("body");
        if(title==null||title.isEmpty()) title="SDM";
        if(body==null||body.isEmpty()) body="إشعار جديد";
        createChannels();
        String url=data.get("url"); if(url==null||url.isEmpty()) url="/notifications";
        Intent intent=new Intent(this,MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.putExtra("sdm_url",url);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi=PendingIntent.getActivity(this,(int)System.currentTimeMillis(),intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        boolean call="call".equals(type);
        NotificationCompat.Builder b=new NotificationCompat.Builder(this,call?CALL_CHANNEL:GENERAL_CHANNEL)
            .setSmallIcon(com.instaIraq.app.R.mipmap.ic_launcher).setContentTitle(title).setContentText(body)
            .setContentIntent(pi).setAutoCancel(true).setPriority(call?NotificationCompat.PRIORITY_MAX:NotificationCompat.PRIORITY_HIGH);
        if(call) b.setCategory(NotificationCompat.CATEGORY_CALL).setOngoing(true).setFullScreenIntent(pi,true);
        NotificationManagerCompat.from(this).notify((int)System.currentTimeMillis(),b.build());
    }

    private void createChannels(){
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O){
            NotificationManager m=getSystemService(NotificationManager.class);
            m.createNotificationChannel(new NotificationChannel(CALL_CHANNEL,"مكالمات SDM",NotificationManager.IMPORTANCE_HIGH));
            m.createNotificationChannel(new NotificationChannel(GENERAL_CHANNEL,"إشعارات SDM",NotificationManager.IMPORTANCE_HIGH));
        }
    }
}
