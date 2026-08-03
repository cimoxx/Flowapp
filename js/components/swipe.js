const Swipe = {
    init(element, onSwipeLeft, onSwipeRight) {
        let startX = 0, currentX = 0;
        
        element.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
        }, {passive: true});

        element.addEventListener('touchmove', e => {
            currentX = e.touches[0].clientX - startX;
            if(Math.abs(currentX) > 20) {
                element.style.transform = `translateX(${currentX}px)`;
            }
        }, {passive: true});

        element.addEventListener('touchend', e => {
            element.style.transform = `translateX(0px)`;
            if (currentX < -80 && onSwipeLeft) { Utils.vibrate(); onSwipeLeft(); }
            if (currentX > 80 && onSwipeRight) { Utils.vibrate(); onSwipeRight(); }
            currentX = 0;
        });
    }
};
