

const urls = [
  "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/short_case/AOC/gt.mp4",
  "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/short_case/Ting/gt.mp4",
  "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/short_case/tianxiaasan/gt.mp4",
  "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/short_case/monalisa/gt.mp4",
];

async function check() {
  console.log("Checking LatentSync repository asset URLs...");
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      console.log(`${url} -> Status: ${res.status}`);
    } catch (err) {
      console.log(`${url} -> Error: ${err.message}`);
    }
  }
}

check();
