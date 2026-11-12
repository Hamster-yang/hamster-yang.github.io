(() => {
    const controls = document.querySelector('.project-filters');
    const cards = Array.from(document.querySelectorAll('.project-card[data-category]'));
    const count = document.getElementById('project-count');
    if (!controls || !cards.length || !count) return;

    const buttons = Array.from(controls.querySelectorAll('button[data-filter]'));
    controls.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-filter]');
        if (!button || !controls.contains(button)) return;
        const category = button.dataset.filter;
        let visibleCount = 0;

        cards.forEach((card) => {
            const visible = category === 'all' || card.dataset.category === category;
            card.hidden = !visible;
            if (visible) visibleCount += 1;
        });
        buttons.forEach((item) => {
            item.setAttribute('aria-pressed', String(item === button));
        });
        count.textContent = `${visibleCount} 個工具`;
    });

    // Without JavaScript, all projects remain visible and usable.
    controls.hidden = false;
})();
