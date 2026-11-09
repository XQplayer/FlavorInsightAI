export async function* parseAiEvents(stream) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replaceAll('\r\n', '\n')
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        for (const line of frame.split('\n')) {
          if (line.startsWith('data: ')) yield JSON.parse(line.slice(6))
        }
        boundary = buffer.indexOf('\n\n')
      }
      if (done) break
    }
  } finally {
    reader.releaseLock()
  }
}

export async function* verifiedAiEvents(stream) {
  let completed = false
  for await (const event of parseAiEvents(stream)) {
    if (event.type === 'error') throw new Error(event.message || event.code || 'AI response failed')
    if (event.type === 'done') completed = true
    yield event
  }
  if (!completed) throw new Error('AI response stream ended before completion; retry this question')
}
