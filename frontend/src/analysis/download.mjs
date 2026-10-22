export function downloadFile(name, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], {
      type
    })),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
