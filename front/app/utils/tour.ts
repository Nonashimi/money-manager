import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

/** Shared driver.js config (Russian labels, theming via .mm-tour-popover in main.css) for every page tour. */
export function createTour(steps: DriveStep[], onFinish: () => void) {
  return driver({
    showProgress: true,
    progressText: '{{current}} из {{total}}',
    nextBtnText: 'Далее',
    prevBtnText: 'Назад',
    doneBtnText: 'Готово',
    popoverClass: 'mm-tour-popover',
    onDestroyed: onFinish,
    steps
  })
}
