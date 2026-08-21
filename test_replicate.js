import Replicate from "replicate";
import dotenv from "dotenv";

dotenv.config();

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function test() {
  console.log("Starting test prediction for Kokoro TTS...");
  try {
    const output = await replicate.run(
      "alphanumericuser/kokoro-82m:89b6fa84e4fa2dd6bd3a96be3e1f12827a3516c9fda8fddbac7a0be131c9a6f5",
      {
        input: {
          text: "Hello, this is a test of the video training tool using Kokoro TTS.",
          voice: "af_bella",
          speed: 1.0,
        }
      }
    );
    console.log("Prediction complete!");
    console.log("Output structure:", typeof output, output);
    if (output && output.toString) {
      console.log("As string:", output.toString());
    }
  } catch (error) {
    console.error("Error during prediction:", error);
  }
}

test();
