# Media player module

`<gui-media-player>` provides responsive on-demand and live playback without a
runtime dependency.

Supported inputs:

- MP4, WebM, and other formats supported by the host engine;
- native HLS on engines that expose it;
- live `MediaStream` inputs from WebRTC, capture devices, or canvas capture;
- pluggable adapters for HLS, DASH, encrypted, or application-specific media.

The component includes accessible controls, keyboard shortcuts, fullscreen,
Picture-in-Picture, captions, playback speed, auto-hiding chrome, buffering and
error states, live-edge seeking, and reduced-motion behavior.

See [the complete media guide](../../../docs/MEDIA_PLAYER.md).
