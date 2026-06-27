<script setup>
const props = withDefaults(defineProps(), {
  shimmerColor: '#ffffff',
  background: 'var(--primary)',
  borderRadius: '100px',
  shimmerDuration: '3s',
  disabled: false,
  loading: false,
  type: 'button',
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="shimmer-btn"
    :style="{
      '--shimmer-color': shimmerColor,
      '--bg': background,
      '--radius': borderRadius,
      '--speed': shimmerDuration,
    }"
  >
    <div class="shimmer-layer" aria-hidden="true">
      <div class="shimmer-spin" />
    </div>
    <span class="shimmer-content">
      <slot />
    </span>
    <div class="shimmer-bg" aria-hidden="true" />
  </button>
</template>

<style scoped>
.shimmer-btn {
  position: relative;
  z-index: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--radius, 100px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 0.65rem 1.5rem;
  color: #fff;
  font-weight: 600;
  font-size: var(--fs-sm);
  background: var(--bg, var(--primary));
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
  white-space: nowrap;
  font-family: inherit;
}

.shimmer-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.shimmer-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shimmer-layer {
  position: absolute;
  inset: 0;
  z-index: -2;
  overflow: hidden;
  filter: blur(2px);
}

.shimmer-spin {
  position: absolute;
  inset: -100%;
  background: conic-gradient(
    from 270deg,
    transparent 0,
    var(--shimmer-color, #fff) 30deg,
    transparent 30deg
  );
  animation: shimmer-spin calc(var(--speed, 3s) * 2) linear infinite;
}

.shimmer-content {
  position: relative;
  z-index: 1;
}

.shimmer-bg {
  position: absolute;
  inset: 2px;
  z-index: -1;
  border-radius: calc(var(--radius, 100px) - 2px);
  background: var(--bg, var(--primary));
  box-shadow: inset 0 -6px 10px rgba(255, 255, 255, 0.12);
}

.shimmer-btn:hover .shimmer-bg {
  box-shadow: inset 0 -6px 10px rgba(255, 255, 255, 0.22);
}

@keyframes shimmer-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
