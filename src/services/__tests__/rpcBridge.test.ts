import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type Listener = (event: { payload: string }) => void | Promise<void>

const tauriEvent = vi.hoisted(() => ({
  listen: vi.fn(),
  unlisten: vi.fn(),
  callback: null as Listener | null,
}))
const platform = vi.hoisted(() => ({ isTauriDesktop: vi.fn(() => true) }))
const voice = vi.hoisted(() => ({
  isConnected: true,
  toggleMute: vi.fn(async () => true),
  toggleDeafen: vi.fn(async () => true),
  toggleVideo: vi.fn(async () => true),
  toggleScreenShare: vi.fn(async () => true),
}))

vi.mock('@tauri-apps/api/event', () => ({ listen: tauriEvent.listen }))
vi.mock('@/utils/platform', () => ({ isTauriDesktop: platform.isTauriDesktop }))
vi.mock('@/stores/unifiedVoiceChannel', () => ({
  useUnifiedVoiceChannelStore: () => voice,
}))

import { RPC_ENABLED_STORAGE_KEY, startRpcBridge, stopRpcBridge } from '@/services/rpcBridge'

const actions = ['togglemute', 'toggledeaf', 'togglecamera', 'togglescreenshare']
const storeMethods = [
  voice.toggleMute,
  voice.toggleDeafen,
  voice.toggleVideo,
  voice.toggleScreenShare,
]

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
  voice.isConnected = true
  voice.toggleMute.mockReset()
  voice.toggleMute.mockResolvedValue(true)
  voice.toggleDeafen.mockReset()
  voice.toggleDeafen.mockResolvedValue(true)
  voice.toggleVideo.mockReset()
  voice.toggleVideo.mockResolvedValue(true)
  voice.toggleScreenShare.mockReset()
  voice.toggleScreenShare.mockResolvedValue(true)
})

afterEach(() => {
  stopRpcBridge()
  localStorage.clear()
})

describe('rpcBridge', () => {
  it('dispatches all four actions to their store methods while enabled', async () => {
    localStorage.setItem(RPC_ENABLED_STORAGE_KEY, 'true')
    await startRpcBridge()
    expect(tauriEvent.listen).toHaveBeenCalledTimes(1)

    await invoke('togglemute')
    await invoke('toggledeaf')
    await invoke('togglecamera')
    await invoke('togglescreenshare')

    expect(voice.toggleMute).toHaveBeenCalledTimes(1)
    expect(voice.toggleDeafen).toHaveBeenCalledTimes(1)
    expect(voice.toggleVideo).toHaveBeenCalledTimes(1)
    expect(voice.toggleScreenShare).toHaveBeenCalledTimes(1)
  })

  it('refuses camera and screen share while disconnected', async () => {
    voice.isConnected = false
    localStorage.setItem(RPC_ENABLED_STORAGE_KEY, 'true')
    await startRpcBridge()

    await invoke('togglecamera')
    await invoke('togglescreenshare')

    expect(voice.toggleVideo).not.toHaveBeenCalled()
    expect(voice.toggleScreenShare).not.toHaveBeenCalled()
  })

  it('dispatches mute and deafen while disconnected', async () => {
    voice.isConnected = false
    localStorage.setItem(RPC_ENABLED_STORAGE_KEY, 'true')
    await startRpcBridge()

    await invoke('togglemute')
    await invoke('toggledeaf')

    expect(voice.toggleMute).toHaveBeenCalledTimes(1)
    expect(voice.toggleDeafen).toHaveBeenCalledTimes(1)
  })

  it('ignores all commands while disabled', async () => {
    await startRpcBridge()
    for (const action of actions) await invoke(action)
    for (const method of storeMethods) expect(method).not.toHaveBeenCalled()

    localStorage.setItem(RPC_ENABLED_STORAGE_KEY, 'false')
    for (const action of actions) await invoke(action)
    for (const method of storeMethods) expect(method).not.toHaveBeenCalled()
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

    for (const method of storeMethods) expect(method).not.toHaveBeenCalled()
  })
})
