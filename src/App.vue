<template>
  <div id="app">
    <router-view />
    <div class="toast-host">
      <transition-group name="toast-fade">
        <div
          v-for="t in toastState.toasts"
          :key="t.id"
          class="toast"
          :class="'toast--' + t.type"
        >{{ t.message }}</div>
      </transition-group>
    </div>
  </div>
</template>

<script>
import { toastState } from '@/utils/toast'

export default {
  name: 'App',
  data() {
    return { toastState }
  },
}
</script>

<style lang="scss">
.toast-host {
  position: fixed;
  top: 68px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.toast {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  color: #fff;
  background: #1f2937;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  max-width: 60vw;

  &.toast--success { background: #059669; }
  &.toast--warn { background: #d97706; }
  &.toast--error { background: #dc2626; }
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}

.toast-fade-enter,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
