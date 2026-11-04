---
title: External control (RPC)
description: Control your own mic, deafen, camera and screen share from a desktop shortcut with the harmony rpc command, including GNOME custom shortcuts on Wayland.
---
# External control (RPC)

External control lets a command outside Harmony toggle your own mic, deafen, camera and screen share in a running desktop client. It is off by default and has four actions: `togglemute`, `toggledeaf`, `togglecamera` and `togglescreenshare`. It is available in the desktop app only.

This is how a desktop shortcut can control your own call controls from anywhere, including on Wayland, where push-to-talk keys do not reach.

## Turn it on

Open **User settings** → **Advanced** → **Desktop app** → **External control (RPC)** and turn it on. The setting is stored per device, like the other desktop options.

## Commands

For an installed deb, or an AppImage installed on your `PATH` as `harmony`:

```sh
harmony rpc togglemute
```

If you run the AppImage file directly:

```sh
./Harmony_Linux_X.Y.Z.AppImage rpc togglemute
```

| Command | Effect |
| --- | --- |
| `togglemute` | Toggles your own mic. |
| `toggledeaf` | Toggles your own deafen. Also implies mute, as the in-app control does. |
| `togglecamera` | Toggles your camera. Does nothing unless you are in a call. |
| `togglescreenshare` | Toggles your screen share. Does nothing unless you are in a call. |

Camera and screen share are call-only. Mute and deafen also work while you are disconnected and prime your next join.

Exit codes:

- `0`: a running Harmony instance received the command.
- `1`: no running instance received it. Harmony prints `no running Harmony instance` on stderr.

An RPC call never launches a new client.

## What it does

- Toggles the requested control on the currently active call, the same as the in-app shortcut. With more than one call open, it acts on the active one.
- `togglemute` and `toggledeaf` work while you are disconnected and prime your next join, as the in-app shortcuts do. A stray keypress can therefore change whether you join muted or deafened.
- `togglecamera` and `togglescreenshare` are call-only. They do nothing while you are disconnected.
- `togglemute` and `toggledeaf` refuse a locked mute or server-deafen state and show the app's explanation. The command still exits `0`, because the running instance received it.
- In push-to-talk mode, unmuting only re-arms the key; the mic stays closed until you hold it.
- Acts on you only. It cannot mute or deafen other people, connect or disconnect calls, sign you in, or touch files or windows.

## Push to talk

Push to talk is not exposed over RPC. A GNOME custom shortcut fires only on key press, while push-to-talk needs both a press and a release to open and close the mic. On Wayland, global key release is also blocked, so an external tool cannot see when you let go.

Use the in-app push-to-talk keybind where your desktop supports it. Otherwise, use a compositor or tool that can send both press and release events; wiring that into RPC is future work.

## GNOME custom shortcut

To bind a key in GNOME Settings:

1. Open **Settings** → **Keyboard** → **View Customization Settings** → **Custom Shortcuts**.
2. Add a shortcut with the name `Harmony mute` and the command `bash -c 'harmony rpc togglemute'`.
3. Bind the key you want.

Each toggle is its own custom shortcut. Add another shortcut for each command you want to bind, for example `bash -c 'harmony rpc toggledeaf'`, `bash -c 'harmony rpc togglecamera'` or `bash -c 'harmony rpc togglescreenshare'`.

Or set it from a terminal:

```sh
gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "['/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/harmony-mute/']"
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/harmony-mute/ name 'Harmony mute'
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/harmony-mute/ command "bash -c 'harmony rpc togglemute'"
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/harmony-mute/ binding '<Super>m'
```

The first command replaces the list of custom keybindings. If you already have some, add this path to the existing list instead.

For an instant path that skips starting a second process, call the running instance's D-Bus object directly:

```sh
gdbus call --session \
  --dest online.knowmad.harmony.SingleInstance \
  --object-path /online/knowmad/harmony/SingleInstance \
  --method org.SingleInstance.DBus.ExecuteCallback "['rpc','togglemute']" "/"
```

Use this as the shortcut command if you installed the AppImage by path and do not want to wait for it to mount. You can put any of the other commands in place of `togglemute`.

## Security

- External control is local only. There is no network listener and no TCP port; nothing here is reachable over the network or from web content.
- It reuses the single-instance D-Bus object Harmony already runs. Any process in your desktop session can already call that object's `ExecuteCallback` method, which normally only focuses the window. Enabling RPC widens that to toggling your mic, deafen, camera and screen share. Same-user processes only: the session bus is per user.
- The Rust-side flag is `rpc.json` in the app data directory, mode `0600`.
- Every dispatched action is logged.
