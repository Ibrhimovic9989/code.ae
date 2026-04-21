/**
 * Parses text/event-stream from a fetch Response body.
 * Yields each event as { event, data } — data is parsed JSON if possible.
 */
export async function* parseSseStream(
  res: Response,
): AsyncGenerator<{ event: string; data: unknown }> {
  if (!res.body) throw new Error('Response has no body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIdx: number;
    while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);
      const parsed = parseEvent(raw);
      if (parsed) yield parsed;
    }
  }

  if (buffer.trim()) {
    const parsed = parseEvent(buffer);
    if (parsed) yield parsed;
  }
}

function parseEvent(raw: string): { event: string; data: unknown } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  const dataText = dataLines.join('\n');
  try {
    return { event, data: JSON.parse(dataText) };
  } catch {
    return { event, data: dataText };
  }
}
