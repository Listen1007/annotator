import Vue from 'vue'

/**
 * 轻量 toast 通知（替代原 alert）
 * 用法：import { toast } from '@/utils/toast'; toast('消息', 'success')
 */
const state = new Vue({
  data: { toasts: [] },
})

let uid = 0

export function toast(message, type = 'info', duration = 3000) {
  const id = ++uid
  state.toasts.push({ id, message, type })
  if (state.toasts.length > 5) state.toasts.shift()
  setTimeout(() => {
    const inx = state.toasts.findIndex((t) => t.id === id)
    if (inx > -1) state.toasts.splice(inx, 1)
  }, duration)
}

export const toastState = state
