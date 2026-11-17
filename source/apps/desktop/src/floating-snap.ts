/** 纯几何计算使用屏幕逻辑坐标，兼容负坐标的副屏。 */
export function floatingSnapTarget(ball: { x: number; y: number }, bounds: { x: number; y: number; width: number; height: number },
  workArea: { x: number; y: number; width: number; height: number }, distance: number, size = 72): { x: number; y: number; docked?: 'left' | 'right' } {
  const left = ball.x - bounds.x, right = bounds.x + bounds.width - ball.x - size
  const docked = left <= distance && left <= right ? 'left' : right <= distance ? 'right' : undefined
  const top = ball.y - workArea.y, bottom = workArea.y + workArea.height - ball.y - size
  const y = top <= distance && top <= bottom ? workArea.y : bottom <= distance ? workArea.y + workArea.height - size : ball.y
  return { x: ball.x, y, ...(docked ? { docked } : {}) }
}
