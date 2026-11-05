// Built-in kernel client module: registers one panel with the page shell.
window.__DSH_KERNEL_UI__ ??= {}
const registry = window.__DSH_KERNEL_UI__
registry.modules ??= []
registry.modules.push({
  id: 'kernel-hello',
  mount(root) {
    const line = document.createElement('p')
    line.dataset.kernelModule = 'kernel-hello'
    line.textContent = 'Loaded client module: kernel-hello'
    root.append(line)
  },
})
