# Product tour video

Regenerates the voiced walkthrough at `public/tutorial/how-to-use-carbon-logic.mp4`.

```bash
npx playwright install chromium
python3 -m pip install --user edge-tts
npm run tutorial:video
```

The capture step films the real UI with a visible pointer — clicking, typing, and navigating. There is no zoom. Narration uses Microsoft’s Copilot voice `en-US-AndrewMultilingualNeural`.
