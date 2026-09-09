package com.allenscreations.timelessrewards;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import net.sqlcipher.database.SQLiteDatabase;
import net.sqlcipher.database.SQLiteOpenHelper;
import org.json.JSONObject;
import java.util.Iterator;

public class NativeStorageEngine extends SQLiteOpenHelper {
    private static final String DATABASE_NAME = "tcrp_offline_secure.db";
    private static final int DATABASE_VERSION = 1;
    private static final String TABLE_CACHE = "app_cache";
    private static final String COL_KEY = "k";
    private static final String COL_VAL = "v";
    private static final String COL_TIMESTAMP = "ts";
    private static volatile NativeStorageEngine instance;
    private final String dbPassphrase;

    public static synchronized NativeStorageEngine getInstance(Context context) {
        if (instance == null) {
            SQLiteDatabase.loadLibs(context.getApplicationContext());
            instance = new NativeStorageEngine(context.getApplicationContext());
        }
        return instance;
    }

    private NativeStorageEngine(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
        this.dbPassphrase = "tcrp_" + context.getPackageName() + "_offline_binary_cache";
    }

    @Override
    public void onConfigure(SQLiteDatabase db) {
        super.onConfigure(db);
        try {
            db.rawExecSQL("PRAGMA journal_mode=WAL;");
            db.rawExecSQL("PRAGMA synchronous=NORMAL;");
            db.rawExecSQL("PRAGMA cache_size=-8000;");
        } catch (Exception ignored) {}
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS " + TABLE_CACHE + " (" +
                COL_KEY + " TEXT PRIMARY KEY, " +
                COL_VAL + " TEXT, " +
                COL_TIMESTAMP + " INTEGER);");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_cache_ts ON " + TABLE_CACHE + "(" + COL_TIMESTAMP + ");");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_CACHE);
        onCreate(db);
    }

    public synchronized void put(String key, String value) {
        if (key == null) return;
        SQLiteDatabase db = getWritableDatabase(dbPassphrase);
        ContentValues cv = new ContentValues();
        cv.put(COL_KEY, key);
        cv.put(COL_VAL, value);
        cv.put(COL_TIMESTAMP, System.currentTimeMillis());
        db.insertWithOnConflict(TABLE_CACHE, null, cv, SQLiteDatabase.CONFLICT_REPLACE);
    }

    public synchronized String get(String key) {
        if (key == null) return null;
        SQLiteDatabase db = getReadableDatabase(dbPassphrase);
        Cursor cursor = null;
        try {
            cursor = db.query(TABLE_CACHE, new String[]{COL_VAL}, COL_KEY + " = ?", new String[]{key}, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                return cursor.getString(0);
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (cursor != null) cursor.close();
        }
        return null;
    }

    public synchronized boolean remove(String key) {
        if (key == null) return false;
        SQLiteDatabase db = getWritableDatabase(dbPassphrase);
        return db.delete(TABLE_CACHE, COL_KEY + " = ?", new String[]{key}) > 0;
    }

    public synchronized void clear() {
        SQLiteDatabase db = getWritableDatabase(dbPassphrase);
        db.delete(TABLE_CACHE, null, null);
    }

    public synchronized void putBatch(String jsonString) {
        if (jsonString == null || jsonString.isEmpty()) return;
        try {
            JSONObject obj = new JSONObject(jsonString);
            SQLiteDatabase db = getWritableDatabase(dbPassphrase);
            db.beginTransaction();
            try {
                Iterator<String> keys = obj.keys();
                long now = System.currentTimeMillis();
                while (keys.hasNext()) {
                    String k = keys.next();
                    String v = obj.getString(k);
                    ContentValues cv = new ContentValues();
                    cv.put(COL_KEY, k);
                    cv.put(COL_VAL, v);
                    cv.put(COL_TIMESTAMP, now);
                    db.insertWithOnConflict(TABLE_CACHE, null, cv, SQLiteDatabase.CONFLICT_REPLACE);
                }
                db.setTransactionSuccessful();
            } finally {
                db.endTransaction();
            }
        } catch (Exception ignored) {}
    }
}
