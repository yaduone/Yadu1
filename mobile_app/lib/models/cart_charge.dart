/// A configurable charge shown at cart confirmation (platform fee, delivery
/// charge, QA fees…). Configured per delivery type in the admin panel.
/// An [amount] of 0 is rendered as a green "Free" label.
class CartCharge {
  final String id;
  final String name;
  final double amount;

  const CartCharge({
    required this.id,
    required this.name,
    required this.amount,
  });

  bool get isFree => amount <= 0;

  factory CartCharge.fromJson(Map<String, dynamic> json) {
    return CartCharge(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      amount: (json['amount'] ?? 0).toDouble(),
    );
  }

  static List<CartCharge> listFromJson(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => CartCharge.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  static double totalOf(List<CartCharge> charges) =>
      charges.fold<double>(0, (sum, c) => sum + c.amount);
}
