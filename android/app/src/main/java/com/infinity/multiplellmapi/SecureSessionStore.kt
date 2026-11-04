package com.infinity.multiplellmapi

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Stores only an AES-GCM ciphertext in private SharedPreferences. The AES key
 * is generated inside Android Keystore and is not exportable from the device.
 * Provider API keys are never stored by this class; they remain on the gateway.
 */
class SecureSessionStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(
        PREFS_NAME,
        Context.MODE_PRIVATE,
    )

    @Synchronized
    fun save(session: StoredGatewaySession) {
        require(session.gateway.startsWith("https://", ignoreCase = true)) {
            "Only HTTPS gateway sessions can be stored."
        }
        require(session.token.isNotBlank()) { "Session token cannot be empty." }

        val payload = JSONObject()
            .put("gateway", session.gateway.trim().trimEnd('/'))
            .put("token", session.token)
            .put("email", session.email)
            .toString()
            .toByteArray(Charsets.UTF_8)

        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val ciphertext = cipher.doFinal(payload)
        val encoded = JSONObject()
            .put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
            .toString()

        check(preferences.edit().putString(PAYLOAD_KEY, encoded).commit()) {
            "Unable to persist the encrypted gateway session."
        }
    }

    @Synchronized
    fun load(): StoredGatewaySession? {
        val encoded = preferences.getString(PAYLOAD_KEY, null) ?: return null
        return try {
            val envelope = JSONObject(encoded)
            val iv = Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)
            val ciphertext = Base64.decode(envelope.getString("ciphertext"), Base64.NO_WRAP)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(128, iv))
            val payload = JSONObject(String(cipher.doFinal(ciphertext), Charsets.UTF_8))
            val gateway = payload.getString("gateway").trim().trimEnd('/')
            val token = payload.getString("token")
            if (!gateway.startsWith("https://", ignoreCase = true) || token.isBlank()) {
                clear()
                null
            } else {
                StoredGatewaySession(gateway, token, payload.optString("email"))
            }
        } catch (_: Exception) {
            // Invalidated Keystore key, corrupt ciphertext, or an old format:
            // fail closed and require a fresh sign-in.
            clear()
            null
        }
    }

    @Synchronized
    fun clear() {
        preferences.edit().remove(PAYLOAD_KEY).commit()
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return generator.generateKey()
    }

    companion object {
        private const val ANDROID_KEY_STORE = "AndroidKeyStore"
        private const val KEY_ALIAS = "infinity.gateway.session.aes.v1"
        private const val PREFS_NAME = "infinity_secure_session_v1"
        private const val PAYLOAD_KEY = "encrypted_session_envelope"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}

data class StoredGatewaySession(
    val gateway: String,
    val token: String,
    val email: String,
)
