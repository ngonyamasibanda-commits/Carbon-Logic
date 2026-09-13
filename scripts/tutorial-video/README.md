# Product tour video

Regenerates the voiced walkthrough at `public/tutorial/how-to-use-carbon-logic.mp4`.

```bash
npx playwright install chromium
python3 -m pip install --user edge-tts
npm run tutorial:video
```

The capture step films the real UI against a local demo workspace. Narration uses the Microsoft neural voice `en-GB-SoniaNeural`.
