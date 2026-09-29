if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A instalação do PWA é opcional; falhas de registro não devem bloquear o sistema.
    })
  })
}
