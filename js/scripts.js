// 粒子背景配置 - Matrix Style
particlesJS('particles-js', {
    particles: {
        number: { value: 100, density: { enable: true, value_area: 800 } },
        color: { value: '#00ff41' },
        shape: { type: 'circle' },
        opacity: { value: 0.6, random: true, anim: { enable: true, speed: 1, opacity_min: 0.1, sync: false } },
        size: { value: 2, random: true, anim: { enable: true, speed: 2, size_min: 0.1, sync: false } },
        line_linked: { enable: true, distance: 150, color: '#00ff41', opacity: 0.3, width: 1 },
        move: { enable: true, speed: 1.5, direction: 'none', random: true, straight: false, out_mode: 'out', bounce: false }
    },
    interactivity: {
        detect_on: 'canvas',
        events: { 
            onhover: { enable: true, mode: 'grab' }, 
            onclick: { enable: true, mode: 'push' }, 
            resize: true 
        },
        modes: { 
            grab: { distance: 150, line_linked: { opacity: 0.8 } },
            push: { particles_nb: 4 } 
        }
    },
    retina_detect: true
});

// 導航欄滾動效果
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.pageYOffset > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// 漢堡選單
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('nav-menu');
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// 點擊導航連結後關閉選單
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// 滾動動畫觀察器
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -100px 0px' });

document.querySelectorAll('.about-card, .timeline-item, .skill-category, .contact-method').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(el);
});

// 平滑滾動
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
        }
    });
});

// 添加矩陣雨效果到終端機
function createMatrixRain() {
    const terminal = document.querySelector('.terminal-body');
    if (!terminal) return;
    
    setInterval(() => {
        const chars = '01';
        const randomChar = chars[Math.floor(Math.random() * chars.length)];
        const span = document.createElement('span');
        span.textContent = randomChar;
        span.style.cssText = `
            position: absolute;
            color: var(--primary-color);
            opacity: 0;
            animation: matrixFall 2s linear;
            pointer-events: none;
        `;
        span.style.left = Math.random() * 100 + '%';
        terminal.appendChild(span);
        
        setTimeout(() => span.remove(), 2000);
    }, 200);
}

// 執行矩陣雨效果
setTimeout(createMatrixRain, 1000);

// 載入動畫
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease-in';
        document.body.style.opacity = '1';
    }, 100);
});
