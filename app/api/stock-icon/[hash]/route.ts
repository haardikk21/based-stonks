const CACHE_SECONDS = 2592000;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return new Response("Not found", { status: 404 });
  }

  const response = await fetch(
    `https://metadata.coinbase.com/equity_icons/${hash}.png`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    return new Response("Unable to load stock icon", { status: 502 });
  }

  const image = new Uint8Array(await response.arrayBuffer());
  if (!PNG_SIGNATURE.every((byte, index) => image[index] === byte)) {
    return new Response("Invalid stock icon", { status: 502 });
  }

  return new Response(image, {
    headers: {
      "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, immutable`,
      "Content-Type": "image/png",
      "Content-Length": String(image.byteLength),
    },
  });
}
