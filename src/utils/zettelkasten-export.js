/**
 * Export entry to Zettelkasten markdown file
 * Calls backend API to write file to disk
 */
export async function exportEntryToZettelkasten(entry) {
  try {
    const res = await fetch('/api/export-zettelkasten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: entry.id,
        garden: entry.garden,
        type: entry.type,
        category: entry.category,
        tags: entry.tags,
        embedding: entry.embedding,
        foundation: entry.foundation || false,
        captured: entry.created_at || new Date().toISOString(),
        content: entry.content
      })
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Export failed')
    }

    return {
      success: true,
      filePath: data.filePath,
      message: `✅ Exported to ${data.filePath}`
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `⚠️ Export failed: ${error.message}`
    }
  }
}

/**
 * Helper to determine if entry should be exported
 */
export function shouldExportEntry(entry) {
  return entry && entry.id && entry.garden && entry.content
}
