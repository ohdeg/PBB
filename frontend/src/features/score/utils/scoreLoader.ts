import JSZip from 'jszip';

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function isZipBuffer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

function isMusicXmlText(text: string): boolean {
  const normalized = stripBom(text).trim();
  return (
    normalized.startsWith('<?xml') ||
    normalized.includes('<score-partwise') ||
    normalized.includes('<score-timewise')
  );
}

async function extractMusicXmlFromMxl(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');

  if (containerXml) {
    const match = containerXml.match(/full-path="([^"]+)"/i);
    if (match?.[1]) {
      const rootXml = await zip.file(match[1])?.async('string');
      if (rootXml) {
        return rootXml;
      }
    }
  }

  const xmlEntry = Object.keys(zip.files).find(
    (name) =>
      (name.endsWith('.xml') || name.endsWith('.musicxml')) && !name.startsWith('META-INF/'),
  );
  if (xmlEntry) {
    const xml = await zip.file(xmlEntry)?.async('string');
    if (xml) {
      return xml;
    }
  }

  throw new Error('No MusicXML found in MXL file');
}

export async function blobToMusicXml(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const xmlText = isZipBuffer(bytes)
    ? await extractMusicXmlFromMxl(buffer)
    : stripBom(new TextDecoder('utf-8').decode(buffer)).trim();

  if (!isMusicXmlText(xmlText)) {
    throw new Error('Invalid MusicXML file content');
  }

  return xmlText;
}
