let touchStartX = 0;
let touchStartY = 0;
let isSwiping = false;

function handleSwipeStart(e, id) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isSwiping = false;

    const el = document.getElementById(`item-${id}`);
    if (el) el.classList.add('swiping');
}

function handleSwipeMove(e, id) {
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartX;
    const diffY = touch.clientY - touchStartY;

    if (!isSwiping && Math.abs(diffY) > 10 && Math.abs(diffY) > Math.abs(diffX)) {
        const el = document.getElementById(`item-${id}`);
        if (el) {
            el.style.transform = 'translateX(0px)';
            el.classList.remove('swiping');
        }
        return;
    }

    if (Math.abs(diffX) > 10) {
        isSwiping = true;
    }

    if (isSwiping) {
        const el = document.getElementById(`item-${id}`);
        const bg = document.getElementById(`bg-${id}`);
        if (!el || !bg) return;

        const translateX = Math.max(-120, Math.min(120, diffX));
        el.style.transform = `translateX(${translateX}px)`;
        bg.style.opacity = Math.min(1, Math.abs(translateX) / 40);

        if (translateX > 0) {
            bg.className = "swipe-bg bg-emerald-500";
        } else {
            bg.className = "swipe-bg bg-rose-500";
        }
    }
}

function handleSwipeEnd(e, id, processed) {
    const el = document.getElementById(`item-${id}`);
    const bg = document.getElementById(`bg-${id}`);
    if (!el) return;

    el.classList.remove('swiping');

    const style = window.getComputedStyle(el);
    const matrix = new WebKitCSSMatrix(style.transform);
    const translateX = matrix.m41;

    if (translateX > 80) {
        toggleProcessed(id);
    } else if (translateX < -80) {
        handleDelete(id);
    }

    el.style.transform = 'translateX(0px)';
    if (bg) bg.style.opacity = '0';

    const touch = e.changedTouches ? e.changedTouches[0] : null;
    let totalDist = 0;
    if (touch) {
        const totalDiffX = touch.clientX - touchStartX;
        const totalDiffY = touch.clientY - touchStartY;
        totalDist = Math.sqrt(totalDiffX * totalDiffX + totalDiffY * totalDiffY);
    }

    if (!isSwiping && Math.abs(translateX) < 5 && totalDist < 8) {
        openModal(id);
    }

    isSwiping = false;
}
