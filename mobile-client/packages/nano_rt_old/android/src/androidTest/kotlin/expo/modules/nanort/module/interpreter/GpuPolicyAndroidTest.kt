package expo.modules.nanort.module.interpreter

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.internal.GpuPolicy
import expo.modules.nanort.module.interpreter.internal.GpuQuarantineStore
import expo.modules.nanort.module.interpreter.internal.InferenceFlags
import expo.modules.nanort.module.interpreter.testing.FakePrefsDisk
import expo.modules.nanort.module.interpreter.testing.FakeSharedPreferences
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.tensorflow.lite.gpu.CompatibilityList

@RunWith(AndroidJUnit4::class)
class GpuPolicyAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun gpu_disabled_always_returns_false() {
    val policy = createPolicy(
      compatSupported = true,
      quarantined = false,
    )

    InferenceFlags.gpuEnabled = false
    try {
      assertFalse(policy.shouldUseGpu(ModelId.RS))
    } finally {
      InferenceFlags.gpuEnabled = true
    }
  }

  @Test
  fun quarantine_returns_false_even_if_supported() {
    val policy = createPolicy(
      compatSupported = true,
      quarantined = true,
    )

    InferenceFlags.gpuEnabled = true
    assertFalse(policy.shouldUseGpu(ModelId.RS))
  }

  @Test
  fun unsupported_device_returns_false() {
    val policy = createPolicy(
      compatSupported = false,
      quarantined = false,
    )

    InferenceFlags.gpuEnabled = true
    assertFalse(policy.shouldUseGpu(ModelId.RS))
  }

  @Test
  fun blacklisted_device_signature_returns_false() {
    val policy = createPolicy(
      compatSupported = true,
      quarantined = false,
      buildInfo = GpuPolicy.BuildInfo(
        fingerprint = "any/fingerprint",
        manufacturer = "motorola",
        model = "whatever",
        device = "bangkk",
        hardware = "any",
      )
    )

    InferenceFlags.gpuEnabled = true
    assertFalse(policy.shouldUseGpu(ModelId.RS))
  }

  @Test
  fun supported_and_not_quarantined_can_return_true() {
    val policy = createPolicy(
      compatSupported = true,
      quarantined = false,
    )

    InferenceFlags.gpuEnabled = true
    assertTrue(policy.shouldUseGpu(ModelId.IC))
  }

  private fun createPolicy(
    compatSupported: Boolean,
    quarantined: Boolean,
    buildInfo: GpuPolicy.BuildInfo = GpuPolicy.BuildInfo(
      fingerprint = "google/sdk_gphone64_arm64/emu:15/test/release-keys",
      manufacturer = "google",
      model = "sdk_gphone64_arm64",
      device = "emu64",
      hardware = "ranchu",
    ),
  ): GpuPolicy {
    val disk = FakePrefsDisk()
    val prefs = FakeSharedPreferences(disk)
    val store = GpuQuarantineStore(preferencesOverride = prefs)
    if (quarantined) {
      store.setQuarantinedWithReason(ModelId.RS, "test")
    }

    return GpuPolicy(
      compat = CompatibilityList(),
      quarantine = store,
      compatSupportedOverride = { compatSupported },
      buildInfo = buildInfo,
    )
  }
}
