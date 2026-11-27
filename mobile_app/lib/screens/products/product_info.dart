/// Read-only accessors over a product doc exactly as the admin saved it
/// (`GET /api/products`), so the list, the detail sheet and Home agree on
/// images, prices and which delivery modes a product is offered in.
class ProductInfo {
  ProductInfo._();

  static String id(Map<String, dynamic> p) => p['id'] as String? ?? '';
  static String name(Map<String, dynamic> p) => p['name'] as String? ?? '';
  static String unit(Map<String, dynamic> p) => p['unit'] as String? ?? '';
  static String description(Map<String, dynamic> p) =>
      (p['description'] as String? ?? '').trim();
  static bool isActive(Map<String, dynamic> p) => p['is_active'] == true;

  /// Admin availability: `scheduled`, `instant` or `both`. Docs saved before
  /// the field existed are scheduled-only, matching the backend.
  static String availability(Map<String, dynamic> p) {
    final value = p['availability'];
    return value is String && value.isNotEmpty ? value : 'scheduled';
  }

  static bool offersScheduled(Map<String, dynamic> p) =>
      availability(p) != 'instant';

  static bool offersInstant(Map<String, dynamic> p) {
    final value = availability(p);
    return value == 'instant' || value == 'both';
  }

  static double? scheduledPrice(Map<String, dynamic> p) =>
      (p['price'] as num?)?.toDouble();

  /// The instant store charges `instant_price` when the admin set one.
  static double? instantPrice(Map<String, dynamic> p) =>
      (p['instant_price'] as num?)?.toDouble() ?? scheduledPrice(p);

  static String formatPrice(double? price) =>
      price == null ? '—' : '₹${price.toStringAsFixed(price % 1 == 0 ? 0 : 2)}';

  /// Small cover for thumbnails, falling back to the first uploaded image.
  static String thumbnail(Map<String, dynamic> p) {
    final cover = p['cover_image_small'] ?? p['cover_image_large'];
    if (cover is String && cover.isNotEmpty) return cover;
    final images = p['images'];
    if (images is List) {
      return images.whereType<String>().firstWhere(
        (image) => image.isNotEmpty,
        orElse: () => '',
      );
    }
    return '';
  }

  /// Gallery order: the large cover first, then every other upload.
  static List<String> gallery(Map<String, dynamic> p) {
    final urls = <String>[];
    final cover = p['cover_image_large'] ?? p['cover_image_small'];
    if (cover is String && cover.isNotEmpty) urls.add(cover);
    final images = p['images'];
    if (images is List) {
      for (final image in images.whereType<String>()) {
        if (image.isNotEmpty && !urls.contains(image)) urls.add(image);
      }
    }
    return urls;
  }

  static String titleFromSlug(String slug) => slug
      .split('_')
      .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');
}
