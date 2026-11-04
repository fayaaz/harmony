import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type Listener = (event: { payload: string }) => void | Promise<void>

const tauriEvent = vi.hoisted(() => ({
  listen: vi.fn(),
  unlisten: vi.fn(),
  callback: null as Listener | null,
}))
const platform = vi.hoisted(() => ({ isTauriDesktop: vi.fn(() => true) }))
const voice = vi.hoisted(() => ({ toggleMute: vi.fn(async () => true) }))

vi.mock('@tauri-apps/api/event', () => ({ listen: tauriEvent.listen }))
vi.mock('@/utils/platform', () => ({ isTauriDesktop: platform.isTauriDesktop }))
vi.mock('@/stores/unifiedVoiceChannel', () => ({
  useUnifiedVoiceChannelStore: () => ({ toggleMute: voice.toggleMute }),
}))

import { RPC_ENABLED_STORAGE_KEY, startRpcBridge, stopRpcBridge } from '@/services/rpcBridge'

async function invoke(payload: string): Promise<void> {
  await tauriEvent.callback?.({ payload })
}

beforeEach(() => {
  stopRpcBridge()
  localStorage.clear()
  tauriEvent.listen.mockReset()
  tauriEvent.unlisten.mockReset()
  tauriEvent.callback = null
  tauriEvent.listen.mockImplementation(async (_name: string, cb: Listener) => {
    tauriEvent.callback = cb
    return tauriEvent.unlisten
  })
  platform.isTauriDesktop.mockReset()
  platform.isTauriDesktop.mockReturnValue(true)
  voice.toggleMute.mockReset()
  voice.toggleMute.mockResolvedValue(true)
})

afterEach(() => {
  stopRpcBridge()
  localStorage.clear()
})

describe('rpcBridge', () => {
  it('dispatches togglemute while enabled', async () => {
    localStorage.setItem(RPC_ENABLED_STORAGE_KEY, 'true')
    await startRpcBridge()
    expect(tauriEvent.listen).toHaveBeenCalledTimes(1)

    await invoke('togglemute')

    expect(voice.toggleMute).toHaveBeenCalledTimes(1)
  })

  it('ignores commands while disabled', async () => {
    await startRpcBridge()
    await invoke('togglemute')
    expect(voice.toggleMute).not.toHaveBeenCalled()

    localStorage.setItem(RPC_ENABLED_STORAGE_KEY, 'false')
    await invoke('togglemute')
    expect(voice.toggleMute).not.toHaveBeenCalled()
  })

  it('does not register a listener outside the desktop runtime', async () => {
    platform.isTauriDesktop.mockReturnValue(false)

    await startRpcBridge()

    expect(tauriEvent.listen).not.toHaveBeenCalled()
  })

  it('ignores unknown actions while enabled', async () => {
    localStorage.setItem(RPC_ENABLED_STORAGE_KEY, 'true')
    await startRpcBridge()

    await invoke('deafen')

    expect(voice.toggleMute).not.toHaveBeenCalled()
  })
})
