import { toUiLocale } from '@/lib/locale-routing'

const copy = {
  de: { failed: 'Dein letzter Speicherpunkt konnte gerade nicht mit deinem Account synchronisiert werden.', conflict: 'Auf einem anderen Gerät wurde weitergelernt. Lade den aktuellen Speicherpunkt, bevor du hier fortsetzt.', retry: 'Erneut versuchen', reload: 'Speicherpunkt laden', loading: 'Dein Speicherpunkt wird geladen …' },
  en: { failed: 'Your latest checkpoint could not be synced with your account.', conflict: 'Learning continued on another device. Load the current checkpoint before continuing here.', retry: 'Try again', reload: 'Load checkpoint', loading: 'Loading your checkpoint …' },
  ru: { failed: 'Не удалось синхронизировать последнюю точку сохранения с аккаунтом.', conflict: 'Обучение продолжилось на другом устройстве. Загрузите текущую точку сохранения.', retry: 'Повторить', reload: 'Загрузить сохранение', loading: 'Загрузка сохранения …' },
  uk: { failed: 'Не вдалося синхронізувати останню точку збереження з акаунтом.', conflict: 'Навчання продовжилося на іншому пристрої. Завантажте поточну точку збереження.', retry: 'Спробувати знову', reload: 'Завантажити збереження', loading: 'Завантаження збереження …' },
  tr: { failed: 'Son kayıt noktanız hesabınızla eşitlenemedi.', conflict: 'Başka bir cihazda öğrenmeye devam edildi. Devam etmeden önce güncel kayıt noktasını yükleyin.', retry: 'Tekrar dene', reload: 'Kayıt noktasını yükle', loading: 'Kayıt noktası yükleniyor …' },
}
export function learningCheckpointCopy(lang: string) { return copy[toUiLocale(lang)] }
