/// Model for items in the pending (unconfirmed) cart on the mobile app.
/// These items are stored locally until the user confirms the cart.
class PendingCartItem {
  final String productId;
  final String productName;
  final int quantity;
  final String unit;
  final double price;
  final double total;
  final String? coverImage;

  PendingCartItem({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unit,
    required this.price,
    required this.total,
    this.coverImage,
  });

  factory PendingCartItem.fromProduct(
    Map<String, dynamic> product,
    int quantity,
  ) {
    final price = (product['price'] as num?)?.toDouble() ?? 0.0;
    final cover = (product['cover_image_small'] ?? product['cover_image_large']) as String?;
    final images = product['images'];
    final coverImage = (cover != null && cover.isNotEmpty)
        ? cover
        : (images is List && images.isNotEmpty ? images[0] as String? : null);

    return PendingCartItem(
      productId: product['id'] as String,
      productName: product['name'] as String? ?? 'Unknown Product',
      quantity: quantity,
      unit: product['unit'] as String? ?? 'unit',
      price: price,
      total: price * quantity,
      coverImage: coverImage,
    );
  }

  PendingCartItem copyWith({
    String? productId,
    String? productName,
    int? quantity,
    String? unit,
    double? price,
    double? total,
    String? coverImage,
  }) {
    final newQuantity = quantity ?? this.quantity;
    final newPrice = price ?? this.price;

    return PendingCartItem(
      productId: productId ?? this.productId,
      productName: productName ?? this.productName,
      quantity: newQuantity,
      unit: unit ?? this.unit,
      price: newPrice,
      total: total ?? (newPrice * newQuantity),
      coverImage: coverImage ?? this.coverImage,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'product_id': productId,
      'product_name': productName,
      'quantity': quantity,
      'unit': unit,
      'price': price,
      'total': total,
      'cover_image': coverImage,
    };
  }

  /// Rebuilds a [PendingCartItem] from a cached JSON map (see [toJson]).
  factory PendingCartItem.fromJson(Map<String, dynamic> json) {
    final price = (json['price'] as num?)?.toDouble() ?? 0.0;
    final quantity = (json['quantity'] as num?)?.toInt() ?? 0;
    return PendingCartItem(
      productId: json['product_id'] as String? ?? '',
      productName: json['product_name'] as String? ?? 'Unknown Product',
      quantity: quantity,
      unit: json['unit'] as String? ?? 'unit',
      price: price,
      total: (json['total'] as num?)?.toDouble() ?? price * quantity,
      coverImage: json['cover_image'] as String?,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PendingCartItem &&
          runtimeType == other.runtimeType &&
          productId == other.productId &&
          quantity == other.quantity;

  @override
  int get hashCode => productId.hashCode ^ quantity.hashCode;
}
