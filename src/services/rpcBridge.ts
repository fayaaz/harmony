import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { isTauriDesktop } from '@/utils/platform'
import { debug } from '@/utils/debug'

export const RPC_ENABLED_STORAGE_KEY = 'harmony-rpc-enabled'

let unlisten: UnlistenFn | null = null

export function isRpcEnabled(): boolean {
  try {
    return localStorage.getItem(RPC_ENABLED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

async function runDefaultAction(action: string): Promise<void> {
  if (
    action !== 'togglemute' &&
    action !== 'toggledeaf' &&
    action !== 'togglecamera' &&
    action !== 'togglescreenshare'
  ) {
    return
  }
  try {
    const { useUnifiedVoiceChannelStore } = await import('@/stores/unifiedVoiceChannel')
    const store = useUnifiedVoiceChannelStore()
    switch (action) {
      case 'togglemute':
        await store.toggleMute()
        break
      case 'toggledeaf':
        await store.toggleDeafen()
        break
      case 'togglecamera':
        if (!store.isConnected) {
          debug.log('[RPC] ignoring togglecamera while disconnected')
          return
        }
        await store.toggleVideo()
        break
      case 'togglescreenshare':
        if (!store.isConnected) {
          debug.log('[RPC] ignoring togglescreenshare while disconnected')
          return
        }
        await store.toggleScreenShare()
        break
    }
  } catch (error) {
    debug.warn(`[RPC] ${action} failed:`, error)
  }
}

export async function startRpcBridge(
  handler?: (action: string) => void | Promise<void>,
): Promise<void> {
  if (!isTauriDesktop()) return
  if (unlisten) return

  try {
    unlisten = await listen<string>(
      'rpc://command',
      async (event) => {
        const action = event.payload
        if (!isRpcEnabled()) {
          debug.log('[RPC] ignoring command while disabled:', action)
          return
        }
        debug.log('[RPC] dispatching command:', action)
        try {
          await (handler ? handler(action) : runDefaultAction(action))
        } catch (error) {
          debug.warn('[RPC] command failed:', error)
        }
      },
      { target: 'main' },
    )
  } catch (error) {
    debug.warn('[RPC] listener registration failed:', error)
  }
}

export function stopRpcBridge(): void {
  if (!unlisten) return
  unlisten()
  unlisten = null
}
