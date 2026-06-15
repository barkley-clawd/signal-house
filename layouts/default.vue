<template>
  <div class="layout">
    <main class="main">
      <header class="shell-header">
        <div>
          <p class="eyebrow">Signal House</p>
          <h1 class="title">Signal House</h1>
        </div>
        <p class="subtitle">Single-dashboard shell for operator visibility.</p>
      </header>
      <slot />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
}

.layout {
  display: block;
  min-height: 100vh;
}

.main {
  max-width: 1440px;
  margin: 0 auto;
  padding: 2rem;
}

.shell-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #334155;
}

.eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #64748b;
  margin-bottom: 0.35rem;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f1f5f9;
}

.subtitle {
  font-size: 0.875rem;
  color: #94a3b8;
  max-width: 28rem;
  text-align: right;
}

@media (max-width: 768px) {
  .main {
    padding: 1rem;
  }

  .shell-header {
    align-items: start;
    flex-direction: column;
  }

  .subtitle {
    text-align: left;
  }
}
</style>
