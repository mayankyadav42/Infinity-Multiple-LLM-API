package com.infinity.multiplellmapi

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.ModelTraining
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

private val Night = Color(0xFF090A12)
private val Panel = Color(0xFF141625)
private val Muted = Color(0xFF9AA0B5)
private val Violet = Color(0xFF9B8CFF)
private val Cyan = Color(0xFF64D9E8)
private val Green = Color(0xFF55D69E)
private val Danger = Color(0xFFFF8D9A)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val sessionStore = SecureSessionStore(applicationContext)
        setContent { InfinityApp(sessionStore) }
    }
}

private enum class Tab(val label: String, val icon: ImageVector) {
    OVERVIEW("Overview", Icons.Outlined.Dashboard),
    PROVIDERS("Providers", Icons.Outlined.Key),
    MODELS("Models", Icons.Outlined.ModelTraining),
    USAGE("Usage", Icons.Outlined.Storage),
    GATEWAY("Gateway", Icons.Outlined.Cloud),
}

private data class ProviderRow(
    val id: String,
    val name: String,
    val kind: String,
    val keyless: Boolean,
    val configured: Boolean,
    val keys: Int,
    val enabledKeys: Int,
)

private data class ProviderKeyRow(
    val id: Int,
    val platform: String,
    val label: String,
    val maskedKey: String,
    val status: String,
    val enabled: Boolean,
    val keyOptional: Boolean,
    val keyless: Boolean,
    val autoHealthCheck: Boolean,
    val lastHealthyAt: String?,
    val lastHealthError: String?,
)

private data class ModelRow(val provider: String, val name: String, val enabled: Boolean, val source: String)
private data class QuotaPoolRow(
    val provider: String, val label: String, val kind: String, val metric: String?,
    val limit: Double?, val remaining: Double?, val resetAt: String?, val documentedBudget: Double,
    val modelCount: Int, val keyCount: Int, val source: String?, val observedAt: String?, val confidence: Double?,
)
private data class EvidenceRow(
    val id: Int, val providerId: String, val provider: String, val model: String, val classification: String,
    val status: String, val summary: String, val evidenceUrl: String,
)
private data class ClientProfileRow(
    val id: Int, val name: String, val maskedKey: String, val enabled: Boolean, val systemPrompt: String,
)
private data class DashboardSessionRow(
    val sessionId: String, val createdAt: String, val expiresAt: Long, val current: Boolean,
)

@Composable
private fun InfinityApp(sessionStore: SecureSessionStore) {
    var gateway by remember { mutableStateOf("https://") }
    var gatewayDraft by remember { mutableStateOf("https://") }
    var sessionToken by remember { mutableStateOf<String?>(null) }
    var accountEmail by remember { mutableStateOf("") }
    var needsSetup by remember { mutableStateOf(false) }
    var authenticated by remember { mutableStateOf(false) }
    var restoringSession by remember { mutableStateOf(true) }
    var advanced by remember { mutableStateOf(false) }
    var activeTab by remember { mutableStateOf(Tab.OVERVIEW) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("Checking saved secure session…") }
    var messageIsError by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var setupCode by remember { mutableStateOf("") }
    val providers = remember { mutableStateListOf<ProviderRow>() }
    val providerKeys = remember { mutableStateListOf<ProviderKeyRow>() }
    val models = remember { mutableStateListOf<ModelRow>() }
    val quotaPools = remember { mutableStateListOf<QuotaPoolRow>() }
    val reviewItems = remember { mutableStateListOf<EvidenceRow>() }
    val clientProfiles = remember { mutableStateListOf<ClientProfileRow>() }
    var createdClientKey by remember { mutableStateOf<String?>(null) }
    var usageSummary by remember { mutableStateOf("Connect and sign in to load usage data.") }
    val scope = rememberCoroutineScope()

    fun report(text: String, error: Boolean = false) {
        message = text
        messageIsError = error
    }

    fun clearAuthenticatedState(clearStored: Boolean = true) {
        if (clearStored) sessionStore.clear()
        sessionToken = null
        accountEmail = ""
        authenticated = false
        providers.clear()
        providerKeys.clear()
        models.clear()
        quotaPools.clear()
        reviewItems.clear()
        clientProfiles.clear()
        usageSummary = "Sign in to load usage data."
    }

    suspend fun refreshData() {
        val token = sessionToken ?: return
        val base = gateway
        try {
            val providerResponse = apiRequest(base, "/api/keys/providers", "GET", token = token)
            providers.clear()
            val providerArray = providerResponse.optJSONArray("providers") ?: JSONArray()
            for (i in 0 until providerArray.length()) {
                val p = providerArray.optJSONObject(i) ?: continue
                providers.add(
                    ProviderRow(
                        id = p.optString("platform"),
                        name = p.optString("name"),
                        kind = p.optString("kind", "chat"),
                        keyless = p.optBoolean("keyless"),
                        configured = p.optBoolean("configured"),
                        keys = p.optInt("keyCount"),
                        enabledKeys = p.optInt("enabledKeyCount"),
                    ),
                )
            }

            val keyResponse = apiRequest(base, "/api/keys", "GET", token = token)
            val keyArray = keyResponse.optJSONArray("_array") ?: JSONArray()
            providerKeys.clear()
            for (i in 0 until keyArray.length()) {
                val row = keyArray.optJSONObject(i) ?: continue
                providerKeys.add(
                    ProviderKeyRow(
                        id = row.optInt("id"),
                        platform = row.optString("platform"),
                        label = row.optString("label"),
                        maskedKey = row.optString("maskedKey", "••••"),
                        status = row.optString("status", "unknown"),
                        enabled = row.optBoolean("enabled", true),
                        keyOptional = row.optBoolean("keyOptional"),
                        keyless = row.optBoolean("keyless"),
                        autoHealthCheck = row.optBoolean("autoHealthCheck", true),
                        lastHealthyAt = row.optString("lastHealthyAt").takeIf { it.isNotBlank() && it != "null" },
                        lastHealthError = row.optString("lastHealthError").takeIf { it.isNotBlank() && it != "null" },
                    ),
                )
            }

            val modelResponse = apiRequest(base, "/api/models", "GET", token = token)
            models.clear()
            val modelArray = modelResponse.optJSONArray("_array") ?: modelResponse.optJSONArray("models") ?: JSONArray()
            for (i in 0 until modelArray.length()) {
                val m = modelArray.optJSONObject(i) ?: continue
                models.add(
                    ModelRow(
                        provider = m.optString("platform"),
                        name = m.optString("displayName").ifBlank { m.optString("modelId") },
                        enabled = m.optBoolean("enabled"),
                        source = m.optString("source"),
                    ),
                )
            }

            val usage = apiRequest(base, "/api/free-tier", "GET", token = token)
            val pools = usage.optJSONArray("pools") ?: JSONArray()
            val summary = usage.optJSONObject("summary") ?: JSONObject()
            quotaPools.clear()
            for (i in 0 until pools.length()) {
                val pool = pools.optJSONObject(i) ?: continue
                val quota = pool.optJSONObject("quota")
                quotaPools.add(QuotaPoolRow(
                    provider = pool.optString("platform"),
                    label = pool.optString("poolKey"),
                    kind = pool.optString("kind"),
                    metric = quota?.optString("metric")?.takeIf { !it.isNullOrBlank() && it != "null" },
                    limit = quota?.optDouble("limit")?.takeIf { !it.isNaN() && it >= 0 },
                    remaining = quota?.optDouble("remaining")?.takeIf { !it.isNaN() && it >= 0 },
                    resetAt = quota?.optString("resetAt")?.takeIf { !it.isNullOrBlank() && it != "null" },
                    documentedBudget = pool.optDouble("documentedBudget", 0.0),
                    modelCount = pool.optInt("modelCount"),
                    keyCount = pool.optInt("keyCount"),
                    source = quota?.optString("source")?.takeIf { !it.isNullOrBlank() && it != "null" },
                    observedAt = quota?.optString("observedAt")?.takeIf { !it.isNullOrBlank() && it != "null" },
                    confidence = quota?.optDouble("confidence")?.takeIf { !it.isNaN() && it >= 0 },
                ))
            }
            val poolSummary = "${summary.optInt("poolCount", pools.length())} quota pools · ${summary.optInt("creditsBasedPools")} credit-based · ${summary.optInt("unpublishedPools")} without published budgets."
            val analytics = apiRequest(base, "/api/analytics/summary?range=30d", "GET", token = token)
            usageSummary = "$poolSummary Last 30 days: ${analytics.optLong("totalRequests")} requests · ${analytics.optLong("totalInputTokens") + analytics.optLong("totalOutputTokens")} tokens observed by Infinity."

            val reviewResponse = apiRequest(base, "/api/infinity/catalog/review", "GET", token = token)
            val reviewArray = reviewResponse.optJSONArray("items") ?: JSONArray()
            reviewItems.clear()
            for (i in 0 until reviewArray.length()) {
                val item = reviewArray.optJSONObject(i) ?: continue
                reviewItems.add(EvidenceRow(
                    id = item.optInt("id"), providerId = item.optString("provider_id"), provider = item.optString("provider_name", item.optString("provider_id")),
                    model = item.optString("model_id"), classification = item.optString("classification"),
                    status = item.optString("status"), summary = item.optString("evidence_summary"),
                    evidenceUrl = item.optString("evidence_url"),
                ))
            }

            val profilesResponse = apiRequest(base, "/api/client-profiles", "GET", token = token)
            val profilesArray = profilesResponse.optJSONArray("_array") ?: JSONArray()
            clientProfiles.clear()
            for (i in 0 until profilesArray.length()) {
                val profile = profilesArray.optJSONObject(i) ?: continue
                clientProfiles.add(ClientProfileRow(
                    id = profile.optInt("id"), name = profile.optString("name"),
                    maskedKey = profile.optString("maskedKey"), enabled = profile.optBoolean("enabled"),
                    systemPrompt = profile.optString("systemPrompt"),
                ))
            }
            report("Connected · Account data refreshed")
        } catch (e: Exception) {
            report(e.message ?: "Unable to refresh gateway data", true)
        }
    }

    // Resume a previously encrypted session only after the gateway validates it.
    // A network failure keeps the ciphertext for a later retry; a rejected token
    // is erased immediately.
    LaunchedEffect(Unit) {
        val saved = withContext(Dispatchers.IO) { sessionStore.load() }
        if (saved != null) {
            try {
                val status = apiRequest(saved.gateway, "/api/auth/status", "GET", token = saved.token)
                if (status.optBoolean("authenticated")) {
                    gateway = saved.gateway
                    gatewayDraft = saved.gateway
                    accountEmail = status.optString("email", saved.email)
                    sessionToken = saved.token
                    authenticated = true
                    report("Secure session restored · Refreshing gateway data")
                    refreshData()
                } else {
                    clearAuthenticatedState()
                    gateway = saved.gateway
                    gatewayDraft = saved.gateway
                    report("Saved session expired or was revoked. Please sign in again.", true)
                }
            } catch (e: Exception) {
                gateway = saved.gateway
                gatewayDraft = saved.gateway
                report("Could not reach the saved gateway. Your encrypted session was retained; check the connection and sign in when available.", true)
            }
        } else {
            report("Gateway not connected")
        }
        restoringSession = false
    }

    MaterialTheme(colorScheme = MaterialTheme.colorScheme.copy(background = Night, surface = Panel, primary = Violet, secondary = Cyan)) {
        Surface(Modifier.fillMaxSize(), color = Night) {
            Column(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF111326), Night, Night)))) {
                if (restoringSession) {
                    Column(
                        Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        BrandMark()
                        Spacer(Modifier.height(18.dp))
                        androidx.compose.material3.CircularProgressIndicator(color = Violet)
                        Spacer(Modifier.height(12.dp))
                        Text("Validating secure session…", color = Muted, fontSize = 12.sp)
                    }
                } else if (!authenticated) {
                    AuthScreen(
                        gateway = gatewayDraft,
                        onGatewayChange = { gatewayDraft = it },
                        needsSetup = needsSetup,
                        email = email,
                        onEmailChange = { email = it },
                        password = password,
                        onPasswordChange = { password = it },
                        setupCode = setupCode,
                        onSetupCodeChange = { setupCode = it },
                        busy = busy,
                        message = message,
                        messageIsError = messageIsError,
                        onCheck = {
                            scope.launch {
                                busy = true
                                try {
                                    val base = normalizeGateway(gatewayDraft)
                                    val status = apiRequest(base, "/api/auth/status", "GET")
                                    needsSetup = status.optBoolean("needsSetup")
                                    report(if (needsSetup) "Gateway ready · Create the first administrator account" else "Gateway ready · Sign in")
                                } catch (e: Exception) {
                                    report(e.message ?: "Connection failed", true)
                                } finally {
                                    busy = false
                                }
                            }
                        },
                        onSubmit = {
                            scope.launch {
                                busy = true
                                try {
                                    val base = normalizeGateway(gatewayDraft)
                                    val body = JSONObject().put("email", email.trim()).put("password", password)
                                    if (needsSetup) body.put("setupCode", setupCode.trim())
                                    val result = apiRequest(
                                        base,
                                        if (needsSetup) "/api/auth/setup" else "/api/auth/login",
                                        "POST",
                                        body = body,
                                    )
                                    val token = result.getString("token")
                                    val userEmail = result.optString("email", email.trim())
                                    gateway = base
                                    gatewayDraft = base
                                    sessionToken = token
                                    accountEmail = userEmail
                                    authenticated = true
                                    try {
                                        withContext(Dispatchers.IO) {
                                            sessionStore.clear()
                                            sessionStore.save(StoredGatewaySession(base, token, userEmail))
                                        }
                                        report("Signed in · Session encrypted on this device")
                                    } catch (storeError: Exception) {
                                        report("Signed in, but secure session storage failed. You may need to sign in again after closing the app.", true)
                                    }
                                    password = ""
                                    setupCode = ""
                                    refreshData()
                                } catch (e: Exception) {
                                    report(e.message ?: "Authentication failed", true)
                                } finally {
                                    busy = false
                                }
                            }
                        },
                    )
                } else {
                    Header(advanced = advanced, onToggle = { advanced = !advanced })
                    AnimatedContent(
                        targetState = advanced,
                        transitionSpec = {
                            (fadeIn(tween(360)) + slideInHorizontally(tween(420)) { if (targetState) it / 7 else -it / 7 }) togetherWith
                                (fadeOut(tween(260)) + slideOutHorizontally(tween(320)) { if (targetState) -it / 7 else it / 7 })
                        },
                        label = "mode-transition",
                    ) { isAdvanced ->
                        Column(Modifier.weight(1f)) {
                            when (activeTab) {
                                Tab.OVERVIEW -> OverviewScreen(
                                    accountEmail,
                                    message,
                                    messageIsError,
                                    providers.count { it.configured },
                                    models.size,
                                    usageSummary,
                                    isAdvanced,
                                    onRefresh = {
                                        scope.launch {
                                            busy = true
                                            refreshData()
                                            busy = false
                                        }
                                    },
                                )
                                Tab.PROVIDERS -> ProvidersScreen(
                                    providers = providers,
                                    keys = providerKeys,
                                    advanced = isAdvanced,
                                    busy = busy,
                                    onAdd = { platform, label, key ->
                                        scope.launch {
                                            busy = true
                                            try {
                                                val body = JSONObject()
                                                    .put("platform", platform)
                                                    .put("label", label.trim())
                                                if (key.isNotBlank()) body.put("key", key.trim())
                                                apiRequest(gateway, "/api/keys", "POST", sessionToken, body)
                                                report("Provider credential saved · encrypted by the gateway")
                                                refreshData()
                                            } catch (e: Exception) {
                                                report(e.message ?: "Could not add provider", true)
                                            } finally {
                                                busy = false
                                            }
                                        }
                                    },
                                    onToggle = { row, enabled ->
                                        scope.launch {
                                            busy = true
                                            try {
                                                apiRequest(
                                                    gateway,
                                                    "/api/keys/${row.id}",
                                                    "PATCH",
                                                    sessionToken,
                                                    JSONObject().put("enabled", enabled),
                                                )
                                                report(if (enabled) "Provider key enabled" else "Provider key disabled")
                                                refreshData()
                                            } catch (e: Exception) {
                                                report(e.message ?: "Could not update provider key", true)
                                            } finally {
                                                busy = false
                                            }
                                        }
                                    },
                                    onEdit = { row, label, replacementKey ->
                                        scope.launch {
                                            busy = true
                                            try {
                                                val body = JSONObject().put("label", label.trim())
                                                if (!replacementKey.isNullOrBlank()) body.put("key", replacementKey.trim())
                                                apiRequest(gateway, "/api/keys/${row.id}", "PATCH", sessionToken, body)
                                                report("Provider connection updated")
                                                refreshData()
                                            } catch (e: Exception) {
                                                report(e.message ?: "Could not update provider connection", true)
                                            } finally {
                                                busy = false
                                            }
                                        }
                                    },
                                    onDelete = { row ->
                                        scope.launch {
                                            busy = true
                                            try {
                                                apiRequest(gateway, "/api/keys/${row.id}", "DELETE", sessionToken)
                                                report("Provider key removed from gateway")
                                                refreshData()
                                            } catch (e: Exception) {
                                                report(e.message ?: "Could not remove provider key", true)
                                            } finally {
                                                busy = false
                                            }
                                        }
                                    },
                                    onTest = { row ->
                                        scope.launch {
                                            busy = true
                                            try {
                                                val result = apiRequest(gateway, "/api/health/check/${row.id}", "POST", sessionToken)
                                                val status = result.optString("status", "check completed")
                                                report("${row.platform} · $status", status.equals("invalid", true) || status.equals("error", true))
                                                refreshData()
                                            } catch (e: Exception) {
                                                report(e.message ?: "Provider check failed", true)
                                            } finally {
                                                busy = false
                                            }
                                        }
                                    },
                                )
                                Tab.MODELS -> ModelsScreen(
                                    models = models, reviewItems = reviewItems, advanced = isAdvanced, busy = busy,
                                    onDiscover = { providerId ->
                                        scope.launch {
                                            busy = true
                                            try {
                                                val result = apiRequest(gateway, "/api/infinity/catalog/discover/$providerId", "POST", sessionToken, JSONObject())
                                                report("${providerId}: ${result.optInt("modelsSeen")} scanned · ${result.optInt("modelsAutoAdded")} added · ${result.optInt("modelsSentToReview")} sent to Review")
                                                refreshData()
                                            } catch (e: Exception) { report(e.message ?: "Discovery failed", true) }
                                            finally { busy = false }
                                        }
                                    },
                                    onVerify = { item, evidenceUrl, evidenceSummary, accountTier, regionScope ->
                                        scope.launch {
                                            busy = true
                                            try {
                                                val body = JSONObject()
                                                    .put("providerId", item.providerId)
                                                    .put("modelId", item.model)
                                                    .put("classification", "restricted_free")
                                                    .put("recurringNoCharge", true)
                                                    .put("modelSpecific", true)
                                                    .put("evidenceType", "official_pricing")
                                                    .put("evidenceUrl", evidenceUrl.trim())
                                                    .put("evidenceSummary", evidenceSummary.trim())
                                                    .put("verifiedAt", java.time.Instant.now().toString())
                                                    .put("accountTier", accountTier.trim())
                                                    .put("regionScope", regionScope.trim())
                                                val result = apiRequest(gateway, "/api/infinity/catalog/evidence/evaluate", "POST", sessionToken, body)
                                                report(result.optJSONObject("decision")?.optString("reason") ?: "Evidence evaluated")
                                                refreshData()
                                            } catch (e: Exception) { report(e.message ?: "Evidence verification failed", true) }
                                            finally { busy = false }
                                        }
                                    },
                                    onDismiss = { item ->
                                        scope.launch {
                                            busy = true
                                            try {
                                                apiRequest(gateway, "/api/infinity/catalog/review/${item.id}/dismiss", "POST", sessionToken, JSONObject())
                                                report("${item.model} moved out of Review")
                                                refreshData()
                                            } catch (e: Exception) { report(e.message ?: "Could not update review item", true) }
                                            finally { busy = false }
                                        }
                                    },
                                )
                                Tab.USAGE -> UsageScreen(
                                    usageSummary, quotaPools,
                                    isAdvanced,
                                    onRefresh = {
                                        scope.launch {
                                            busy = true
                                            refreshData()
                                            busy = false
                                        }
                                    },
                                )
                                Tab.GATEWAY -> GatewayScreen(
                                    gateway = gateway,
                                    gatewayDraft = gatewayDraft,
                                    onGatewayDraftChange = { gatewayDraft = it },
                                    status = message,
                                    messageIsError = messageIsError,
                                    advanced = isAdvanced,
                                    busy = busy,
                                    profiles = clientProfiles,
                                    sessionToken = sessionToken,
                                    createdClientKey = createdClientKey,
                                    onDismissCreatedKey = { createdClientKey = null },
                                    onCreateProfile = { name, prompt ->
                                        scope.launch {
                                            busy = true
                                            try {
                                                val result = apiRequest(gateway, "/api/client-profiles", "POST", sessionToken,
                                                    JSONObject().put("name", name).put("systemPrompt", if (prompt.isBlank()) JSONObject.NULL else prompt))
                                                createdClientKey = result.optString("key")
                                                report("Infinity API key created · copy it now; it will not be shown again")
                                                refreshData()
                                            } catch (e: Exception) { report(e.message ?: "Could not create API key", true) }
                                            finally { busy = false }
                                        }
                                    },
                                    onRotateProfile = { profile ->
                                        scope.launch {
                                            busy = true
                                            try {
                                                val result = apiRequest(gateway, "/api/client-profiles/${profile.id}/rotate", "POST", sessionToken, JSONObject())
                                                createdClientKey = result.optString("key")
                                                report("API key rotated · update connected clients")
                                                refreshData()
                                            } catch (e: Exception) { report(e.message ?: "Could not rotate API key", true) }
                                            finally { busy = false }
                                        }
                                    },
                                    onToggleProfile = { profile, enabled ->
                                        scope.launch {
                                            busy = true
                                            try {
                                                apiRequest(gateway, "/api/client-profiles/${profile.id}", "PATCH", sessionToken, JSONObject().put("enabled", enabled))
                                                refreshData()
                                                report(if (enabled) "API key enabled" else "API key disabled")
                                            } catch (e: Exception) { report(e.message ?: "Could not update API key", true) }
                                            finally { busy = false }
                                        }
                                    },
                                    onDeleteProfile = { profile ->
                                        scope.launch {
                                            busy = true
                                            try {
                                                apiRequest(gateway, "/api/client-profiles/${profile.id}", "DELETE", sessionToken)
                                                refreshData()
                                                report("Infinity API key deleted")
                                            } catch (e: Exception) { report(e.message ?: "Could not delete API key", true) }
                                            finally { busy = false }
                                        }
                                    },
                                    onApply = {
                                        scope.launch {
                                            busy = true
                                            try {
                                                val target = normalizeGateway(gatewayDraft)
                                                val ping = apiRequest(target, "/api/ping", "GET")
                                                if (target != gateway) {
                                                    val targetAuth = apiRequest(target, "/api/auth/status", "GET")
                                                    val targetNeedsSetup = targetAuth.optBoolean("needsSetup")
                                                    val oldGateway = gateway
                                                    val oldToken = sessionToken
                                                    if (oldToken != null) {
                                                        try { apiRequest(oldGateway, "/api/auth/logout", "POST", oldToken) } catch (_: Exception) { }
                                                    }
                                                    clearAuthenticatedState()
                                                    gateway = target
                                                    gatewayDraft = target
                                                    needsSetup = targetNeedsSetup
                                                    report(if (targetNeedsSetup) "New gateway online · Create its administrator account" else "Gateway changed · Sign in to the new gateway")
                                                } else {
                                                    report("Gateway online · ${ping.optString("timestamp", "health check passed")}")
                                                    refreshData()
                                                }
                                            } catch (e: Exception) {
                                                report(e.message ?: "Gateway check failed", true)
                                            } finally {
                                                busy = false
                                            }
                                        }
                                    },
                                    onLogout = {
                                        scope.launch {
                                            busy = true
                                            try {
                                                sessionToken?.let { apiRequest(gateway, "/api/auth/logout", "POST", it) }
                                            } catch (_: Exception) {
                                                // Local ciphertext is still removed even if the gateway is offline.
                                            } finally {
                                                clearAuthenticatedState()
                                                gatewayDraft = gateway
                                                report("Signed out · This device's saved session was removed")
                                                busy = false
                                            }
                                        }
                                    },
                                )
                            }
                        }
                    }
                    NavigationBar(containerColor = Panel, contentColor = Violet) {
                        Tab.values().forEach { tab ->
                            NavigationBarItem(
                                selected = activeTab == tab,
                                onClick = { activeTab = tab },
                                icon = { Icon(tab.icon, contentDescription = tab.label) },
                                label = { Text(tab.label, fontSize = 10.sp) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AuthScreen(
    gateway: String,
    onGatewayChange: (String) -> Unit,
    needsSetup: Boolean,
    email: String,
    onEmailChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    setupCode: String,
    onSetupCodeChange: (String) -> Unit,
    busy: Boolean,
    message: String,
    messageIsError: Boolean,
    onCheck: () -> Unit,
    onSubmit: () -> Unit,
) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(22.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp),
    ) {
        Spacer(Modifier.height(24.dp))
        BrandMark()
        Text("Your AI gateway.\nOne control panel.", color = Color.White, fontSize = 30.sp, lineHeight = 36.sp, fontWeight = FontWeight.SemiBold)
        Text("Connect your local or remote Infinity gateway to manage providers, models and usage.", color = Muted, fontSize = 14.sp)
        Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(22.dp)) {
            Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
                Text("Gateway connection", color = Color.White, fontWeight = FontWeight.SemiBold)
                OutlinedTextField(gateway, onGatewayChange, Modifier.fillMaxWidth(), singleLine = true, label = { Text("HTTPS gateway URL") }, placeholder = { Text("https://your-gateway.example.com") })
                Button(onClick = onCheck, enabled = !busy && gateway.isNotBlank(), modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Night)) {
                    Text(if (busy) "Checking…" else "Check gateway")
                }
                HorizontalDivider(color = Color.White.copy(alpha = .08f))
                Text(if (needsSetup) "Create administrator" else "Administrator sign in", color = Color.White, fontWeight = FontWeight.SemiBold)
                OutlinedTextField(email, onEmailChange, Modifier.fillMaxWidth(), singleLine = true, label = { Text("Email") })
                OutlinedTextField(password, onPasswordChange, Modifier.fillMaxWidth(), singleLine = true, visualTransformation = PasswordVisualTransformation(), label = { Text("Password") })
                if (needsSetup) OutlinedTextField(setupCode, onSetupCodeChange, Modifier.fillMaxWidth(), singleLine = true, label = { Text("One-time setup code (remote setup)") })
                Button(onClick = onSubmit, enabled = !busy && email.isNotBlank() && password.isNotBlank(), modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Night)) {
                    Text(if (busy) "Please wait…" else if (needsSetup) "Create account" else "Sign in")
                }
                StatusText(message, messageIsError)
                Text("Your dashboard session is encrypted with an AES-256-GCM key held by Android Keystore. Provider API keys remain on the gateway.", color = Muted, fontSize = 11.sp, lineHeight = 16.sp)
            }
        }
    }
}

@Composable
private fun Header(advanced: Boolean, onToggle: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        BrandMark(compact = true)
        Spacer(Modifier.weight(1f))
        TextButton(onClick = onToggle) { Text(if (advanced) "Simple Mode" else "Advanced Mode", color = Violet, fontWeight = FontWeight.SemiBold) }
    }
}

@Composable
private fun BrandMark(compact: Boolean = false) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(if (compact) 36.dp else 48.dp).height(if (compact) 36.dp else 48.dp).background(Violet.copy(alpha = .16f), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
            Icon(Icons.Outlined.Cloud, contentDescription = null, tint = Violet)
        }
        Spacer(Modifier.width(10.dp))
        Column {
            Text("INFINITY", color = Color.White, fontSize = if (compact) 11.sp else 13.sp, letterSpacing = 3.sp, fontWeight = FontWeight.Bold)
            Text("Multiple LLM API", color = Muted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun OverviewScreen(email: String, status: String, isError: Boolean, providerCount: Int, modelCount: Int, usage: String, advanced: Boolean, onRefresh: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Good to see you", color = Muted, fontSize = 13.sp)
        Text("Your AI ecosystem.\nAt a glance.", color = Color.White, fontSize = 28.sp, lineHeight = 34.sp, fontWeight = FontWeight.SemiBold)
        Text(email, color = Cyan, fontSize = 12.sp)
        StatusText(status, isError)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MetricCard("Providers", providerCount.toString(), Modifier.weight(1f))
            MetricCard("Models", modelCount.toString(), Modifier.weight(1f))
        }
        SectionTitle("SYSTEM STATUS")
        InfoCard("Provider connections", "Manage API keys and account connections", "$providerCount configured")
        InfoCard("Model catalogue", "Verified models and discovery review", "$modelCount available")
        InfoCard("Quota & usage", usage, "Live data from gateway")
        Button(onClick = onRefresh, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Night)) { Icon(Icons.Outlined.Refresh, null); Spacer(Modifier.width(8.dp)); Text("Refresh overview") }
        if (advanced) {
            SectionTitle("ADVANCED DIAGNOSTICS")
            InfoCard("Evidence policy", "Only verified recurring free API access should enter the automatic free catalogue.", "Enabled by product policy")
            InfoCard("Credential boundary", "Provider credentials are stored and used by the gateway, not the Android UI.", "Gateway-side")
        }
    }
}

@Composable
private fun ProvidersScreen(
    providers: List<ProviderRow>,
    keys: List<ProviderKeyRow>,
    advanced: Boolean,
    busy: Boolean,
    onAdd: (String, String, String) -> Unit,
    onToggle: (ProviderKeyRow, Boolean) -> Unit,
    onEdit: (ProviderKeyRow, String, String?) -> Unit,
    onDelete: (ProviderKeyRow) -> Unit,
    onTest: (ProviderKeyRow) -> Unit,
) {
    var selectedProviderId by remember { mutableStateOf("google") }
    var providerMenuExpanded by remember { mutableStateOf(false) }
    var label by remember { mutableStateOf("Google Gemini") }
    var key by remember { mutableStateOf("") }
    var editTarget by remember { mutableStateOf<ProviderKeyRow?>(null) }
    var deleteTarget by remember { mutableStateOf<ProviderKeyRow?>(null) }
    val selectedProvider = providers.firstOrNull { it.id == selectedProviderId } ?: providers.firstOrNull()

    LaunchedEffect(providers) {
        if (providers.isNotEmpty() && providers.none { it.id == selectedProviderId }) {
            val preferred = providers.firstOrNull { it.id == "google" } ?: providers.first()
            selectedProviderId = preferred.id
            label = preferred.name
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text("Providers", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.SemiBold)
            Text("Connect, test, edit, pause or remove provider credentials. Secrets are encrypted by the gateway.", color = Muted, fontSize = 12.sp)
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text("Add provider connection", color = Color.White, fontWeight = FontWeight.SemiBold)
                    Box {
                        Button(
                            onClick = { providerMenuExpanded = true },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF24283D), contentColor = Color.White),
                        ) {
                            Text(selectedProvider?.let { "${it.name} · ${it.id}" } ?: "Select a provider", modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        DropdownMenu(expanded = providerMenuExpanded, onDismissRequest = { providerMenuExpanded = false }) {
                            providers.filter { it.kind == "chat" }.forEach { provider ->
                                DropdownMenuItem(
                                    text = { Text("${provider.name} (${provider.id})") },
                                    onClick = {
                                        selectedProviderId = provider.id
                                        label = provider.name
                                        key = ""
                                        providerMenuExpanded = false
                                    },
                                )
                            }
                        }
                    }
                    OutlinedTextField(label, { label = it }, Modifier.fillMaxWidth(), singleLine = true, label = { Text("Connection label") })
                    OutlinedTextField(
                        key,
                        { key = it },
                        Modifier.fillMaxWidth(),
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        label = { Text(if (selectedProvider?.keyless == true) "API key (optional)" else "Provider API key") },
                    )
                    if (selectedProvider?.keyless == true) {
                        Text("This provider can be added without a key. You can supply a key later by editing the connection.", color = Muted, fontSize = 11.sp)
                    }
                    Button(
                        onClick = { selectedProvider?.let { onAdd(it.id, label, key) }; key = "" },
                        enabled = !busy && selectedProvider != null && (key.isNotBlank() || selectedProvider.keyless),
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Night),
                    ) {
                        Text(if (busy) "Working…" else "Save encrypted connection")
                    }
                    if (advanced) Text("Only provider IDs advertised by this gateway are selectable. OAuth connection flows are added provider-by-provider when officially supported.", color = Cyan, fontSize = 11.sp, lineHeight = 16.sp)
                }
            }
        }
        item { SectionTitle("SAVED API KEYS · ${keys.size}") }
        if (keys.isEmpty()) {
            item { EmptyState("No saved provider keys", "Choose a provider above and add its API key to begin.") }
        } else {
            items(keys, key = { it.id }) { row ->
                ProviderKeyCard(
                    row = row,
                    busy = busy,
                    onToggle = { onToggle(row, it) },
                    onEdit = { editTarget = row },
                    onDelete = { deleteTarget = row },
                    onTest = { onTest(row) },
                )
            }
        }
        item {
            SectionTitle("PROVIDER DIRECTORY · ${providers.size}")
            providers.filter { it.configured }.forEach { p ->
                InfoCard(p.name, "${p.id} · ${p.enabledKeys}/${p.keys} enabled keys", if (p.kind == "search") "Search" else "Chat")
            }
        }
    }

    editTarget?.let { target ->
        var editedLabel by remember(target.id) { mutableStateOf(target.label) }
        var replacementKey by remember(target.id) { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { editTarget = null },
            title = { Text("Edit ${target.platform} connection") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(editedLabel, { editedLabel = it }, Modifier.fillMaxWidth(), singleLine = true, label = { Text("Label") })
                    OutlinedTextField(replacementKey, { replacementKey = it }, Modifier.fillMaxWidth(), singleLine = true, visualTransformation = PasswordVisualTransformation(), label = { Text("Replace API key (optional)") })
                    Text("Leave the replacement key blank to keep the existing credential. The current secret is never sent back to the app.", color = Muted, fontSize = 11.sp)
                }
            },
            confirmButton = {
                TextButton(enabled = !busy, onClick = {
                    onEdit(target, editedLabel, replacementKey.takeIf { it.isNotBlank() })
                    editTarget = null
                }) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { editTarget = null }) { Text("Cancel") } },
        )
    }

    deleteTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Remove provider key?") },
            text = { Text("This permanently removes the saved ${target.platform} credential from the gateway. It does not delete your provider account.") },
            confirmButton = {
                TextButton(enabled = !busy, onClick = {
                    onDelete(target)
                    deleteTarget = null
                }) { Text("Remove", color = Danger) }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun ProviderKeyCard(
    row: ProviderKeyRow,
    busy: Boolean,
    onToggle: (Boolean) -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onTest: () -> Unit,
) {
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(17.dp)) {
        Column(Modifier.fillMaxWidth().padding(13.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(row.label.ifBlank { row.platform }, color = Color.White, fontWeight = FontWeight.SemiBold)
                    Text("${row.platform} · ${row.maskedKey}", color = Muted, fontSize = 11.sp)
                    Text(
                        "Status: ${row.status}${if (row.keyless) " · anonymous connection" else ""}",
                        color = when (row.status.lowercase()) {
                            "healthy" -> Green
                            "invalid", "error" -> Danger
                            else -> Cyan
                        },
                        fontSize = 11.sp,
                    )
                }
                Switch(checked = row.enabled, onCheckedChange = onToggle, enabled = !busy)
            }
            if (!row.lastHealthError.isNullOrBlank()) {
                Text("Last provider error: ${row.lastHealthError}", color = Danger, fontSize = 10.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                TextButton(onClick = onTest, enabled = !busy && row.autoHealthCheck) { Text("Check") }
                IconButton(onClick = onEdit, enabled = !busy) { Icon(Icons.Outlined.Edit, contentDescription = "Edit key or label", tint = Cyan) }
                IconButton(onClick = onDelete, enabled = !busy) { Icon(Icons.Outlined.DeleteOutline, contentDescription = "Remove provider key", tint = Danger) }
                Spacer(Modifier.weight(1f))
                if (!row.autoHealthCheck) Text("Validated on use", color = Muted, fontSize = 10.sp)
                Text(if (row.enabled) "Enabled" else "Paused", color = if (row.enabled) Green else Muted, fontSize = 10.sp)
            }
        }
    }
}

@Composable
private fun ModelsScreen(
    models: List<ModelRow>,
    reviewItems: List<EvidenceRow>,
    advanced: Boolean,
    busy: Boolean,
    onDiscover: (String) -> Unit,
    onVerify: (EvidenceRow, String, String, String, String) -> Unit,
    onDismiss: (EvidenceRow) -> Unit,
) {
    var verifyTarget by remember { mutableStateOf<EvidenceRow?>(null) }
    var selectedSection by remember { mutableStateOf("catalogue") }
    verifyTarget?.let { target ->
        var evidenceUrl by remember(target.id) { mutableStateOf(when (target.providerId) {
            "openrouter" -> "https://openrouter.ai/models"
            "groq" -> "https://groq.com/pricing"
            else -> "https://ai.google.dev/gemini-api/docs/pricing"
        }) }
        var evidenceSummary by remember(target.id) { mutableStateOf("") }
        var accountTier by remember(target.id) { mutableStateOf("Free tier") }
        var regionScope by remember(target.id) { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { verifyTarget = null },
            title = { Text("Verify free-tier evidence") },
            text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Only submit after checking the official pricing documentation for this exact model. Infinity also checks the official evidence host and that the API currently lists the model.", fontSize = 11.sp)
                OutlinedTextField(evidenceUrl, { evidenceUrl = it }, Modifier.fillMaxWidth(), label = { Text("Official pricing URL") })
                OutlinedTextField(evidenceSummary, { evidenceSummary = it }, Modifier.fillMaxWidth(), label = { Text("What does the official source confirm?") }, minLines = 2)
                OutlinedTextField(accountTier, { accountTier = it }, Modifier.fillMaxWidth(), singleLine = true, label = { Text("Eligible account tier") })
                OutlinedTextField(regionScope, { regionScope = it }, Modifier.fillMaxWidth(), singleLine = true, label = { Text("Region scope") })
            } },
            confirmButton = { TextButton(enabled = !busy && evidenceSummary.length >= 8 && regionScope.isNotBlank(), onClick = {
                onVerify(target, evidenceUrl, evidenceSummary, accountTier, regionScope)
                verifyTarget = null
            }) { Text("Evaluate evidence") } },
            dismissButton = { TextButton(onClick = { verifyTarget = null }) { Text("Cancel") } },
        )
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            Text("Model Explorer", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.SemiBold)
            Text("Browse the inference catalogue and inspect newly discovered models.", color = Muted, fontSize = 12.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = { selectedSection = "catalogue" }) { Text("Catalogue (${models.size})", color = if (selectedSection == "catalogue") Violet else Muted) }
                TextButton(onClick = { selectedSection = "review" }) { Text("Review (${reviewItems.size})", color = if (selectedSection == "review") Violet else Muted) }
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("DISCOVERY SOURCES", color = Muted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                    Button(onClick = { onDiscover("google") }, enabled = !busy, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Night)) { Text("Google", fontSize = 11.sp) }
                    Button(onClick = { onDiscover("openrouter") }, enabled = !busy, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Night)) { Text("OpenRouter", fontSize = 11.sp) }
                    Button(onClick = { onDiscover("groq") }, enabled = !busy, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Night)) { Text("Groq", fontSize = 11.sp) }
                    Button(onClick = { onDiscover("cloudflare") }, enabled = !busy, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Night)) { Text("Cloudflare", fontSize = 11.sp) }
                }
                if (busy) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Violet)
            }
            if (advanced) InfoCard("Free-tier policy", "A provider model-list response proves availability, not free access. New models remain in Review until model-specific recurring free-tier evidence is verified.", "Evidence-gated")
        }
        if (selectedSection == "catalogue") {
            item { SectionTitle("INFERENCE CATALOGUE · ${models.size}") }
            if (models.isEmpty()) item { EmptyState("No models loaded", "Connect a gateway with a populated model catalogue.") }
            else items(models) { m -> InfoCard(m.name, "${m.provider} · ${m.source}", if (m.enabled) "Enabled" else "Disabled") }
        } else {
            item { SectionTitle("NEEDS REVIEW · ${reviewItems.size}") }
            if (reviewItems.isEmpty()) item { EmptyState("Review queue is clear", "New or uncertain models will appear here after discovery.") }
            else items(reviewItems, key = { it.id }) { item ->
                Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(16.dp)) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(item.model, color = Color.White, fontWeight = FontWeight.SemiBold)
                        Text("${item.provider} · ${item.classification} · ${item.status}", color = Cyan, fontSize = 11.sp)
                        Text(item.summary, color = Muted, fontSize = 11.sp, lineHeight = 16.sp)
                        Text(item.evidenceUrl, color = Violet, fontSize = 10.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Text("Listing in a provider catalogue does not confirm recurring free API access.", color = Muted, fontSize = 10.sp)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(onClick = { verifyTarget = item }, enabled = !busy) { Text("Verify evidence", color = Green) }
                            TextButton(onClick = { onDismiss(item) }, enabled = !busy) { Text("Dismiss", color = Danger) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun UsageScreen(summary: String, pools: List<QuotaPoolRow>, advanced: Boolean, onRefresh: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(18.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        Text("Quota & Usage", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.SemiBold)
        Text("Provider-reported quota observations and gateway-side usage estimates.", color = Muted, fontSize = 12.sp)
        InfoCard("Quota overview", summary, "Gateway report")
        SectionTitle("PROVIDER QUOTA POOLS · ${pools.size}")
        if (pools.isEmpty()) EmptyState("No quota pools reported", "Connect providers and use the gateway. Providers that do not publish quota information will be labelled accordingly.")
        pools.forEach { pool ->
            val remainingText = if (pool.remaining != null) "${formatCount(pool.remaining)} ${pool.metric ?: "units"} remaining" else "No live remaining value reported"
            val limitText = if (pool.limit != null) " of ${formatCount(pool.limit)}" else ""
            InfoCard(
                pool.provider,
                "${pool.label} · ${pool.kind} · ${pool.modelCount} models · ${pool.keyCount} keys\n$remainingText$limitText",
                listOfNotNull(
                    pool.resetAt?.let { "Reset: $it" } ?: "Reset unknown",
                    pool.source?.let { "Source: ${it.replace('_', ' ')}" },
                    pool.observedAt?.let { "Observed: $it" },
                    pool.confidence?.let { "Confidence: ${(it * 100).toInt()}%" },
                ).joinToString(" · "),
            )
        }
        InfoCard("Infinity-side usage", "Requests and token usage observed through this gateway. Calls made directly to providers outside Infinity are not included.", "Estimated / observed")
        if (advanced) InfoCard("Data confidence", "Official provider usage endpoints and response headers are kept distinct from Infinity estimates. Missing reset information is never guessed.", "Source-labelled")
        Button(onClick = onRefresh, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Night)) { Icon(Icons.Outlined.Refresh, null); Spacer(Modifier.width(8.dp)); Text("Refresh usage") }
    }
}

private fun formatCount(value: Double): String = when {
    value >= 1_000_000 -> "%.2fM".format(value / 1_000_000)
    value >= 1_000 -> "%.1fK".format(value / 1_000)
    else -> "%.0f".format(value)
}

@Composable
private fun GatewayScreen(
    gateway: String,
    gatewayDraft: String,
    onGatewayDraftChange: (String) -> Unit,
    status: String,
    messageIsError: Boolean,
    advanced: Boolean,
    busy: Boolean,
    profiles: List<ClientProfileRow>,
    sessionToken: String?,
    createdClientKey: String?,
    onDismissCreatedKey: () -> Unit,
    onCreateProfile: (String, String) -> Unit,
    onRotateProfile: (ClientProfileRow) -> Unit,
    onToggleProfile: (ClientProfileRow, Boolean) -> Unit,
    onDeleteProfile: (ClientProfileRow) -> Unit,
    onApply: () -> Unit,
    onLogout: () -> Unit,
) {
    val clipboard = LocalClipboardManager.current
    var profileName by remember { mutableStateOf("") }
    var profilePrompt by remember { mutableStateOf("") }
    var deleteProfileTarget by remember { mutableStateOf<ClientProfileRow?>(null) }
    val dashboardSessions = remember { mutableStateListOf<DashboardSessionRow>() }
    var sessionsLoading by remember { mutableStateOf(false) }
    var sessionActionBusy by remember { mutableStateOf(false) }
    var sessionError by remember { mutableStateOf<String?>(null) }
    val sessionScope = rememberCoroutineScope()
    suspend fun loadDashboardSessions() {
        val token = sessionToken ?: return
        sessionsLoading = true
        sessionError = null
        try {
            val result = apiRequest(gateway, "/api/auth/sessions", "GET", token)
            val rows = result.optJSONArray("sessions") ?: JSONArray()
            dashboardSessions.clear()
            for (i in 0 until rows.length()) {
                val row = rows.optJSONObject(i) ?: continue
                dashboardSessions.add(DashboardSessionRow(
                    sessionId = row.optString("sessionId"),
                    createdAt = row.optString("createdAt"),
                    expiresAt = row.optLong("expiresAt"),
                    current = row.optBoolean("current"),
                ))
            }
        } catch (e: Exception) {
            sessionError = e.message ?: "Could not load sessions"
        } finally { sessionsLoading = false }
    }
    if (createdClientKey != null) {
        AlertDialog(
            onDismissRequest = onDismissCreatedKey,
            title = { Text("Copy your Infinity API key") },
            text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("This key is shown only once. Copy it now and store it securely.")
                Text(createdClientKey, color = Violet, fontSize = 12.sp)
            } },
            confirmButton = {
                Row {
                    TextButton(onClick = { clipboard.setText(AnnotatedString(createdClientKey)) }) { Text("Copy key") }
                    TextButton(onClick = onDismissCreatedKey) { Text("Close") }
                }
            },
        )
    }
    deleteProfileTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteProfileTarget = null },
            title = { Text("Delete API key?") },
            text = { Text("${target.name} will no longer authenticate to the Infinity gateway.") },
            confirmButton = { TextButton(onClick = { onDeleteProfile(target); deleteProfileTarget = null }) { Text("Delete", color = Danger) } },
            dismissButton = { TextButton(onClick = { deleteProfileTarget = null }) { Text("Cancel") } },
        )
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(18.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        Text("Gateway", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.SemiBold)
        Text("Choose the local or remote gateway that manages your providers.", color = Muted, fontSize = 12.sp)
        Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Active gateway", color = Color.White, fontWeight = FontWeight.SemiBold)
                Text(gateway, color = Cyan, fontSize = 11.sp)
                OutlinedTextField(gatewayDraft, onGatewayDraftChange, Modifier.fillMaxWidth(), singleLine = true, label = { Text("Gateway HTTPS URL") })
                Button(onClick = onApply, enabled = !busy && gatewayDraft.isNotBlank(), modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Night)) {
                    Text(if (busy) "Checking…" else if (gatewayDraft.trim().trimEnd('/') != gateway) "Test and switch gateway" else "Test connection and refresh")
                }
                StatusText(status, messageIsError)
                if (gatewayDraft.trim().trimEnd('/') != gateway) Text("Switching gateways signs out of the current gateway and asks you to authenticate with the new one.", color = Cyan, fontSize = 11.sp)
            }
        }
        SectionTitle("SIGNED-IN DEVICES · ${dashboardSessions.size}")
        Text("Review active dashboard sessions. Revoking a session signs that device out; session credentials are never displayed here.", color = Muted, fontSize = 11.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Button(onClick = { sessionScope.launch { loadDashboardSessions() } }, enabled = !sessionsLoading && !sessionActionBusy, colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Night)) {
                Text(if (sessionsLoading) "Loading…" else "Refresh sessions")
            }
            TextButton(onClick = {
                sessionScope.launch {
                    val token = sessionToken ?: return@launch
                    sessionActionBusy = true
                    try {
                        val result = apiRequest(gateway, "/api/auth/sessions/revoke-others", "POST", token, JSONObject())
                        loadDashboardSessions()
                        sessionError = "Signed out ${result.optInt("revokedCount")} other session(s)."
                    } catch (e: Exception) { sessionError = e.message ?: "Could not revoke other sessions" }
                    finally { sessionActionBusy = false }
                }
            }, enabled = !sessionActionBusy) { Text("Sign out other devices", color = Danger) }
        }
        LaunchedEffect(gateway, sessionToken) { if (sessionToken != null) loadDashboardSessions() else dashboardSessions.clear() }
        sessionError?.let { Text(it, color = if (it.startsWith("Signed out")) Green else Danger, fontSize = 11.sp) }
        if (dashboardSessions.isEmpty() && !sessionsLoading) EmptyState("No active sessions shown", "Refresh to check the devices currently signed in to this gateway.")
        dashboardSessions.forEach { session ->
            Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(14.dp)) {
                Column(Modifier.fillMaxWidth().padding(13.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (session.current) "This device" else "Other device", color = if (session.current) Cyan else Color.White, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.weight(1f))
                        if (session.current) Text("CURRENT", color = Green, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                    Text("Created: ${session.createdAt}", color = Muted, fontSize = 10.sp)
                    Text("Expires: ${java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", java.util.Locale.US).format(java.util.Date(session.expiresAt))}", color = Muted, fontSize = 10.sp)
                    if (!session.current) TextButton(onClick = {
                        sessionScope.launch {
                            sessionActionBusy = true
                            try {
                                apiRequest(gateway, "/api/auth/sessions/${session.sessionId}", "DELETE", sessionToken)
                                loadDashboardSessions()
                                sessionError = "Selected session revoked."
                            } catch (e: Exception) { sessionError = e.message ?: "Could not revoke session" }
                            finally { sessionActionBusy = false }
                        }
                    }, enabled = !sessionActionBusy) { Text("Revoke this device", color = Danger) }
                }
            }
        }
        SectionTitle("UNIFIED API ACCESS · ${profiles.size}")
        InfoCard("OpenAI-compatible endpoint", "Base URL: ${gateway.trimEnd('/')}/v1\nUse your Infinity API key as the Bearer token. Select a model from the gateway model catalogue.", "For external agents")
        Text("Create separate Infinity API keys for agents, tools and applications. Each key can be revoked independently. A newly created or rotated key is shown once.", color = Muted, fontSize = 11.sp)
        OutlinedTextField(profileName, { profileName = it }, Modifier.fillMaxWidth(), singleLine = true, label = { Text("Client label") })
        OutlinedTextField(profilePrompt, { profilePrompt = it }, Modifier.fillMaxWidth(), label = { Text("Optional system prompt") }, minLines = 2)
        Button(onClick = { onCreateProfile(profileName.trim(), profilePrompt); profileName = ""; profilePrompt = "" }, enabled = !busy && profileName.isNotBlank(), modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Night)) { Text("Create Infinity API key") }
        if (profiles.isEmpty()) EmptyState("No client API keys", "Create a key for an external agent or application.")
        profiles.forEach { profile ->
            Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(16.dp)) {
                Column(Modifier.fillMaxWidth().padding(13.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(profile.name, color = Color.White, fontWeight = FontWeight.SemiBold)
                    Text(profile.maskedKey, color = Cyan, fontSize = 11.sp)
                    if (profile.systemPrompt.isNotBlank()) Text("Custom system prompt configured", color = Muted, fontSize = 10.sp)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (profile.enabled) "Enabled" else "Disabled", color = if (profile.enabled) Green else Muted, fontSize = 11.sp)
                        Spacer(Modifier.weight(1f))
                        Switch(checked = profile.enabled, onCheckedChange = { onToggleProfile(profile, it) }, enabled = !busy)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { onRotateProfile(profile) }, enabled = !busy) { Text("Rotate key") }
                        TextButton(onClick = { deleteProfileTarget = profile }, enabled = !busy) { Text("Delete", color = Danger) }
                    }
                }
            }
        }
        InfoCard("Hybrid deployment", "Android is the control panel. The gateway runs on a local PC/home server or remote VPS; the phone does not need to host a persistent server process.", "Local + remote")
        if (advanced) InfoCard("Security", "The dashboard session is encrypted using a non-exportable Android Keystore key. Provider API keys stay encrypted at the gateway. HTTPS is required.", "AES-GCM + TLS")
        TextButton(onClick = onLogout) { Text("Sign out", color = Danger) }
    }
}

@Composable
private fun MetricCard(title: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(17.dp)) {
        Column(Modifier.padding(15.dp)) { Text(title, color = Muted, fontSize = 12.sp); Text(value, color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.Bold) }
    }
}

@Composable
private fun InfoCard(title: String, description: String, status: String) {
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(16.dp)) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                Text(description, color = Muted, fontSize = 11.sp, lineHeight = 16.sp)
            }
            Spacer(Modifier.width(8.dp))
            Text(status, color = Cyan, fontSize = 10.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, color = Muted, fontSize = 10.sp, letterSpacing = 1.8.sp, fontWeight = FontWeight.Bold)
}

@Composable
private fun StatusText(text: String, error: Boolean) {
    Text(text, color = if (error) Danger else Green, fontSize = 11.sp, lineHeight = 16.sp)
}

@Composable
private fun EmptyState(title: String, detail: String) {
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(16.dp)) {
        Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, color = Color.White, fontWeight = FontWeight.SemiBold)
            Text(detail, color = Muted, fontSize = 12.sp)
        }
    }
}

private fun normalizeGateway(raw: String): String {
    val normalized = raw.trim().trimEnd('/')
    require(normalized.isNotBlank()) { "Enter a gateway URL." }
    val parsed = URL(normalized)
    require(parsed.protocol.equals("https", ignoreCase = true)) {
        "Use an HTTPS gateway URL. Remote and LAN gateways must use TLS."
    }
    require(parsed.host.isNotBlank() && parsed.userInfo == null) { "Enter a valid HTTPS URL without embedded credentials." }
    require(parsed.query == null && parsed.ref == null) { "Gateway URLs cannot include query parameters or fragments." }
    return normalized
}

private suspend fun apiRequest(
    base: String,
    path: String,
    method: String,
    token: String? = null,
    body: JSONObject? = null,
): JSONObject = withContext(Dispatchers.IO) {
    val url = URL(base.trimEnd('/') + path)
    require(url.protocol.equals("https", ignoreCase = true)) { "Refusing to send credentials over a non-HTTPS connection." }
    val connection = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = method
        connectTimeout = 8_000
        readTimeout = 15_000
        instanceFollowRedirects = false
        setRequestProperty("Accept", "application/json")
        setRequestProperty("Cache-Control", "no-store")
        if (!token.isNullOrBlank()) setRequestProperty("Authorization", "Bearer $token")
        if (body != null) {
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }
    }
    try {
        if (body != null) connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val responseText = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
        val json = try {
            if (responseText.trimStart().startsWith("[")) JSONObject().put("_array", JSONArray(responseText))
            else JSONObject(responseText)
        } catch (_: Exception) {
            JSONObject()
        }
        if (code !in 200..299) {
            val errorValue = json.opt("error")
            val error = if (errorValue is JSONObject) errorValue.optString("message") else errorValue?.toString()
            throw IllegalStateException(error?.takeIf { it.isNotBlank() } ?: "Gateway returned HTTP $code")
        }
        json
    } finally {
        connection.disconnect()
    }
}
