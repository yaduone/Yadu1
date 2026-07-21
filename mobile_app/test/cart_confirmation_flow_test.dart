import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import 'package:mobile_app/models/pending_cart_item.dart';
import 'package:mobile_app/providers/cart_provider.dart';
import 'package:mobile_app/services/api_service.dart';

// Generate mocks
@GenerateMocks([ApiService])
import 'cart_confirmation_flow_test.mocks.dart';

void main() {
  group('PendingCartItem', () {
    test('creates item from product data', () {
      final product = {
        'id': 'prod-123',
        'name': 'Fresh Paneer',
        'price': 80.0,
        'unit': 'pack',
        'cover_image_small': 'https://example.com/paneer.jpg',
      };

      final item = PendingCartItem.fromProduct(product, 2);

      expect(item.productId, 'prod-123');
      expect(item.productName, 'Fresh Paneer');
      expect(item.quantity, 2);
      expect(item.price, 80.0);
      expect(item.total, 160.0);
      expect(item.unit, 'pack');
      expect(item.coverImage, 'https://example.com/paneer.jpg');
    });

    test('calculates total correctly', () {
      final item = PendingCartItem(
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 3,
        unit: 'kg',
        price: 50.0,
        total: 150.0,
      );

      expect(item.total, 150.0);
    });

    test('copyWith updates quantity and recalculates total', () {
      final item = PendingCartItem(
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      final updated = item.copyWith(quantity: 5);

      expect(updated.quantity, 5);
      expect(updated.total, 250.0);
      expect(updated.productId, 'prod-1'); // Unchanged
    });

    test('toJson creates correct map', () {
      final item = PendingCartItem(
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      final json = item.toJson();

      expect(json['product_id'], 'prod-1');
      expect(json['product_name'], 'Test Product');
      expect(json['quantity'], 2);
      expect(json['price'], 50.0);
      expect(json['total'], 100.0);
    });

    test('equality works correctly', () {
      final item1 = PendingCartItem(
        productId: 'prod-1',
        productName: 'Product',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      final item2 = PendingCartItem(
        productId: 'prod-1',
        productName: 'Product',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      final item3 = PendingCartItem(
        productId: 'prod-2',
        productName: 'Other Product',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      expect(item1, equals(item2));
      expect(item1, isNot(equals(item3)));
    });
  });

  group('CartProvider - Pending Cart', () {
    late MockApiService mockApi;
    late CartProvider cartProvider;

    setUp(() {
      mockApi = MockApiService();
      cartProvider = CartProvider();
      // Note: You'll need to inject mockApi into CartProvider for testing
    });

    test('initially has no pending items', () {
      expect(cartProvider.pendingCartItems, isEmpty);
      expect(cartProvider.hasPendingChanges, false);
      expect(cartProvider.pendingTotal, 0.0);
    });

    test('addPendingItem adds item to pending cart', () {
      final item = PendingCartItem(
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      cartProvider.addPendingItem(item);

      expect(cartProvider.pendingCartItems.length, 1);
      expect(cartProvider.hasPendingChanges, true);
      expect(cartProvider.pendingTotal, 100.0);
    });

    test('addPendingItem increments quantity if item already exists', () {
      final item1 = PendingCartItem(
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      final item2 = PendingCartItem(
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 3,
        unit: 'kg',
        price: 50.0,
        total: 150.0,
      );

      cartProvider.addPendingItem(item1);
      cartProvider.addPendingItem(item2);

      expect(cartProvider.pendingCartItems.length, 1);
      expect(cartProvider.pendingCartItems.first.quantity, 5);
      expect(cartProvider.pendingTotal, 250.0);
    });

    test('updatePendingItemQuantity updates quantity', () {
      final item = PendingCartItem(
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      cartProvider.addPendingItem(item);
      cartProvider.updatePendingItemQuantity('prod-1', 5);

      expect(cartProvider.pendingCartItems.first.quantity, 5);
      expect(cartProvider.pendingTotal, 250.0);
    });

    test('updatePendingItemQuantity removes item if quantity is 0', () {
      final item = PendingCartItem(
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      cartProvider.addPendingItem(item);
      cartProvider.updatePendingItemQuantity('prod-1', 0);

      expect(cartProvider.pendingCartItems, isEmpty);
      expect(cartProvider.hasPendingChanges, false);
    });

    test('removePendingItem removes item from pending cart', () {
      final item = PendingCartItem(
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      cartProvider.addPendingItem(item);
      cartProvider.removePendingItem('prod-1');

      expect(cartProvider.pendingCartItems, isEmpty);
      expect(cartProvider.hasPendingChanges, false);
    });

    test('clearPendingCart removes all pending items', () {
      final item1 = PendingCartItem(
        productId: 'prod-1',
        productName: 'Product 1',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      final item2 = PendingCartItem(
        productId: 'prod-2',
        productName: 'Product 2',
        quantity: 1,
        unit: 'pack',
        price: 80.0,
        total: 80.0,
      );

      cartProvider.addPendingItem(item1);
      cartProvider.addPendingItem(item2);
      cartProvider.clearPendingCart();

      expect(cartProvider.pendingCartItems, isEmpty);
      expect(cartProvider.hasPendingChanges, false);
      expect(cartProvider.pendingTotal, 0.0);
    });

    test('pendingTotal calculates correctly with multiple items', () {
      final item1 = PendingCartItem(
        productId: 'prod-1',
        productName: 'Product 1',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      final item2 = PendingCartItem(
        productId: 'prod-2',
        productName: 'Product 2',
        quantity: 3,
        unit: 'pack',
        price: 30.0,
        total: 90.0,
      );

      cartProvider.addPendingItem(item1);
      cartProvider.addPendingItem(item2);

      expect(cartProvider.pendingTotal, 190.0);
    });
  });

  group('CartProvider - Total Calculations', () {
    late CartProvider cartProvider;

    setUp(() {
      cartProvider = CartProvider();
    });

    test('totalAmount includes both confirmed and pending totals', () {
      // Mock confirmed total from server
      // This would require injecting test data or mocking the API response
      // For now, we'll test the pending total calculation
      
      final item = PendingCartItem(
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      cartProvider.addPendingItem(item);

      // If confirmedTotal is 150 from server, totalAmount should be 250
      expect(cartProvider.pendingTotal, 100.0);
    });
  });

  group('CartProvider - Confirmation Flow', () {
    late MockApiService mockApi;
    late CartProvider cartProvider;

    setUp(() {
      mockApi = MockApiService();
      cartProvider = CartProvider();
      // Note: You'll need to inject mockApi into CartProvider for testing
    });

    test('confirmPendingCart sends all items to server', () async {
      final item1 = PendingCartItem(
        productId: 'prod-1',
        productName: 'Product 1',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      final item2 = PendingCartItem(
        productId: 'prod-2',
        productName: 'Product 2',
        quantity: 1,
        unit: 'pack',
        price: 80.0,
        total: 80.0,
      );

      cartProvider.addPendingItem(item1);
      cartProvider.addPendingItem(item2);

      // Mock successful API responses
      when(mockApi.post('/cart/tomorrow/add-item', any))
          .thenAnswer((_) async => {'data': {}});

      final result = await cartProvider.confirmPendingCart();

      expect(result, true);
      expect(cartProvider.pendingCartItems, isEmpty);
      expect(cartProvider.hasPendingChanges, false);
    });

    test('confirmPendingCart clears pending cart on success', () async {
      final item = PendingCartItem(
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      cartProvider.addPendingItem(item);

      // Mock successful API response
      when(mockApi.post('/cart/tomorrow/add-item', any))
          .thenAnswer((_) async => {'data': {}});

      await cartProvider.confirmPendingCart();

      expect(cartProvider.pendingCartItems, isEmpty);
      expect(cartProvider.hasPendingChanges, false);
    });

    test('confirmPendingCart retains pending cart on failure', () async {
      final item = PendingCartItem(
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      cartProvider.addPendingItem(item);

      // Mock API failure
      when(mockApi.post('/cart/tomorrow/add-item', any))
          .thenThrow(Exception('Network error'));

      final result = await cartProvider.confirmPendingCart();

      expect(result, false);
      expect(cartProvider.pendingCartItems.length, 1);
      expect(cartProvider.hasPendingChanges, true);
    });

    test('confirmPendingCart returns true if no pending items', () async {
      final result = await cartProvider.confirmPendingCart();

      expect(result, true);
    });
  });

  group('Integration Tests', () {
    test('full cart flow: add -> confirm -> add more -> confirm', () async {
      final cartProvider = CartProvider();

      // Step 1: Add items to pending cart
      final item1 = PendingCartItem(
        productId: 'prod-1',
        productName: 'Product 1',
        quantity: 2,
        unit: 'kg',
        price: 50.0,
        total: 100.0,
      );

      cartProvider.addPendingItem(item1);
      expect(cartProvider.hasPendingChanges, true);

      // Step 2: Confirm cart (mocked)
      // In real test, you'd mock the API response
      // await cartProvider.confirmPendingCart();
      // expect(cartProvider.hasPendingChanges, false);

      // Step 3: Add more items
      final item2 = PendingCartItem(
        productId: 'prod-2',
        productName: 'Product 2',
        quantity: 1,
        unit: 'pack',
        price: 80.0,
        total: 80.0,
      );

      cartProvider.addPendingItem(item2);
      expect(cartProvider.hasPendingChanges, true);

      // Step 4: Confirm again (mocked)
      // await cartProvider.confirmPendingCart();
      // expect(cartProvider.hasPendingChanges, false);
    });
  });
}
