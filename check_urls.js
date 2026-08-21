

const urls = [
  "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/vasa-1/l2/gt.mp4",
  "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/vasa-1/l3/gt.mp4",
  "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/vasa-1/l4/gt.mp4",
  "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/vasa-1/l5/gt.mp4",
  "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/vasa-1/l7/gt.mp4",
  "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/vasa-1/l8/gt.mp4",
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
