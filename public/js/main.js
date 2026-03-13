// Mobile nav toggle
var toggle = document.querySelector('.nav-toggle');
var menu = document.querySelector('.nav-links');

if (toggle) {
    toggle.addEventListener('click', function () {
        toggle.classList.toggle('open');
        menu.classList.toggle('open');
    });
}

// Nav slider animation
var navLinks = document.querySelector('.nav-links');

if (navLinks) {
    var slider = document.createElement('div');
    slider.className = 'nav-slider';
    navLinks.appendChild(slider);

    function moveSlider(el) {
        slider.style.left = el.offsetLeft + 'px';
        slider.style.width = el.offsetWidth + 'px';
    }

    var active = navLinks.querySelector('a.active');
    if (active) moveSlider(active);

    var links = navLinks.querySelectorAll('a');
    links.forEach(function (link) {
        link.addEventListener('mouseenter', function () {
            moveSlider(link);
        });
        link.addEventListener('mouseleave', function () {
            if (active) moveSlider(active);
        });
    });
}

// Contact form feedback
var form = document.getElementById('contactForm');

if (form) {
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = form.querySelector('button[type="submit"]');
        btn.textContent = 'Sent!';
        form.reset();
        setTimeout(function () {
            btn.textContent = 'Send Message';
        }, 2000);
    });
}
