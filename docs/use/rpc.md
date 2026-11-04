---
title: External control (RPC)
description: Control your own mic from a desktop shortcut with the harmony rpc command, including GNOME custom shortcuts on Wayland.
---
# External control (RPC)

External control lets a command outside Harmony toggle your own microphone in a running desktop client. It is off by default and currently has one action, `togglemute`. It is available in the desktop app only.

This is how a desktop shortcut can mute you from anywhere, including on Wayland, where push-to-talk keys do not reach.

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

Exit codes:

- `0`: a running Harmony instance received the command.
- `1`: no running instance received it. Harmony prints `no running Harmony instance` on stderr.

An RPC call never launches a new client.

## What it does

- Toggles the currently active call, the same as the in-app **Toggle mute** shortcut. With more than one call open, it acts on the active one.
- Works while you are disconnected and primes your next join, as the in-app shortcut does. A stray keypress can therefore change whether you join muted.
- Refuses a locked mute or server-deafen state and shows the app's explanation. The command still exits `0`, because the running instance received it.
- In push-to-talk mode, unmuting only re-arms the key; the mic stays closed until you hold it.
- Acts on you only. It cannot mute or deafen other people, connect or disconnect calls, sign you in, or touch files or windows.

## GNOME custom shortcut

To bind a key in GNOME Settings:

1. Open **Settings** → **Keyboard** → **View Customization Settings** → **Custom Shortcuts**.
2. Add a shortcut with the name `Harmony mute` and the command `bash -c 'harmony rpc togglemute'`.
3. Bind the key you want.

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

Use this as the shortcut command if you installed the AppImage by path and do not want to wait for it to mount.

## Security

- External control is local only. There is no network listener and no TCP port; nothing here is reachable over the network or from web content.
- It reuses the single-instance D-Bus object Harmony already runs. Any process in your desktop session can already call that object's `ExecuteCallback` method, which normally only focuses the window. Enabling RPC widens that to toggling your mic. Same-user processes only: the session bus is per user.
- The Rust-side flag is `rpc.json` in the app data directory, mode `0600`.
- Every dispatched action is logged.
