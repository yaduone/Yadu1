import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import 'package:YaduOne/models/pending_cart_item.dart';
import 'package:YaduOne/providers/cart_provider.dart';
import 'package:YaduOne/providers/instant_provider.dart';
import 'package:YaduOne/screens/products/products_screen.dart';

/// Catalogue as the admin defined it: one product per availability setting,
/// plus one with a separate instant price and one switched off.
final _catalogue = <Map<String, dynamic>>[
  {
    'id': 'paneer',
    'name': 'Fresh Paneer',
    'unit': '200 g',
    'category': 'dairy',
    'description': 'Soft paneer made this morning.',
    'price': 90,
    'instant_price': 95,
    'availability': 'both',
    'is_active': true,
  },
  {
    'id': 'ghee',
    'name': 'Desi Ghee',
    'unit': '500 ml',
    'category': 'dairy',
    'price': 450,
    'availability': 'scheduled',
    'is_active': true,
  },
  {
    'id': 'lassi',
    'name': 'Sweet Lassi',
    'unit': '250 ml',
    'category': 'drinks',
    'price': 30,
    'availability': 'instant',
    'is_active': true,
  },
  {
    'id': 'cheese',
    'name': 'Cheese Slices',
    'unit': '10 pcs',
    'category': 'dairy',
    'price': 120,
    'availability': 'both',
    'is_active': false,
  },
];

class _FakeCart extends CartProvider {
  final Map<String, dynamic>? status;
  final List<PendingCartItem> _pending = [];

  _FakeCart({this.status = const {'date': '2026-11-28', 'is_locked': false}});

  @override
  List<dynamic> get products => _catalogue;
  @override
  bool get productsLoaded => true;
  @override
  List<dynamic> get categories => const [
    {'slug': 'dairy', 'label': 'Dairy'},
    {'slug': 'drinks', 'label': 'Drinks'},
  ];
  @override
  bool get categoriesLoaded => true;
  @override
  Map<String, dynamic>? get tomorrowStatus => status;
  @override
  bool get isLoading => false;
  @override
  List<PendingCartItem> get pendingCartItems => List.unmodifiable(_pending);

  @override
  Future<void> loadProducts({bool forceRefresh = false}) async {}
  @override
  Future<void> loadCategories({bool forceRefresh = false}) async {}
  @override
  Future<void> ensureTomorrowStatusLoaded() async {}
  @override
  Future<void> loadTomorrowStatus() async {}

  @override
  void addPendingItem(PendingCartItem item) {
    final i = _pending.indexWhere((p) => p.productId == item.productId);
    if (i >= 0) {
      _pending[i] = _pending[i].copyWith(
        quantity: _pending[i].quantity + item.quantity,
      );
    } else {
      _pending.add(item);
    }
    notifyListeners();
  }

  @override
  void updatePendingItemQuantity(String productId, int quantity) {
    final i = _pending.indexWhere((p) => p.productId == productId);
    if (i < 0) return;
    if (quantity <= 0) {
      _pending.removeAt(i);
    } else {
      _pending[i] = _pending[i].copyWith(quantity: quantity);
    }
    notifyListeners();
  }
}

class _FakeInstant extends InstantProvider {
  final bool open;

  _FakeInstant({this.open = true});

  /// What `GET /products?availability=instant` returns.
  @override
  List<dynamic> get products => _catalogue
      .where((p) => p['availability'] != 'scheduled')
      .toList(growable: false);
  @override
  bool get productsLoaded => true;
  @override
  bool get isInstantOpen => open;
  @override
  bool get isInstantDisabled => false;
  @override
  String? get windowLabel => '8:00 AM – 9:00 PM';
  @override
  int? get minutesUntilOpen => open ? null : 120;
  @override
  int? get minutesUntilClose => open ? 300 : null;
  @override
  int get etaMinutes => 30;
  @override
  int get itemCount => _catalogue.fold<int>(
    0,
    (sum, p) => sum + quantityOf(p['id'] as String),
  );

  @override
  Future<void> ensureLoaded() async {}
  @override
  Future<void> loadOrders({bool forceRefresh = false}) async {}
  @override
  Future<void> loadAvailability() async {}
}

Future<void> _pump(
  WidgetTester tester, {
  required CartProvider cart,
  required InstantProvider instant,
}) async {
  // A small phone, where a crowded card would overflow first.
  tester.view.physicalSize = const Size(360, 780);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<CartProvider>.value(value: cart),
        ChangeNotifierProvider<InstantProvider>.value(value: instant),
      ],
      child: const MaterialApp(home: ProductsScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

Finder _tileOf(String name) => find.ancestor(
  of: find.text(name),
  matching: find.byWidgetPredicate(
    (w) => w.runtimeType.toString() == '_ProductTile',
  ),
);

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('every product offers both delivery modes, gated by admin '
      'availability', (tester) async {
    await _pump(tester, cart: _FakeCart(), instant: _FakeInstant());

    // Both modes' live status above the list.
    expect(find.text('Delivers Sat, 28 Nov'), findsOneWidget);
    expect(find.text('Open now'), findsOneWidget);

    // "both" → two live add buttons.
    final paneer = _tileOf('Fresh Paneer');
    expect(
      find.descendant(of: paneer, matching: find.text('Scheduled')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: paneer, matching: find.text('Instant')),
      findsOneWidget,
    );
    // Separate instant price is shown next to the base price.
    expect(
      find.descendant(of: paneer, matching: find.text('₹95 instant')),
      findsOneWidget,
    );

    // "scheduled" → instant button explains instead of adding.
    expect(
      find.descendant(
        of: _tileOf('Desi Ghee'),
        matching: find.text('Scheduled only'),
      ),
      findsOneWidget,
    );

    // Switched-off product can't be added at all.
    await tester.scrollUntilVisible(
      find.text('Cheese Slices'),
      200,
      scrollable: find
          .descendant(
            of: find.byType(CustomScrollView),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    expect(
      find.descendant(
        of: _tileOf('Cheese Slices'),
        matching: find.text('Coming soon'),
      ),
      findsOneWidget,
    );

    // "instant" (Drinks category) → scheduled button explains.
    await tester.tap(find.text('Drinks'));
    await tester.pumpAndSettle();
    expect(find.text('Instant only'), findsOneWidget);
  });

  testWidgets('adding goes to the matching cart and becomes a stepper', (
    tester,
  ) async {
    final cart = _FakeCart();
    final instant = _FakeInstant();
    await _pump(tester, cart: cart, instant: instant);

    final paneer = _tileOf('Fresh Paneer');
    await tester.tap(
      find.descendant(of: paneer, matching: find.text('Scheduled')),
    );
    await tester.pumpAndSettle();
    expect(cart.pendingCartItems.single.productId, 'paneer');
    expect(cart.pendingCartItems.single.price, 90);
    expect(find.text('1 item to confirm'), findsOneWidget);

    await tester.tap(
      find.descendant(of: paneer, matching: find.text('Instant')),
    );
    await tester.pumpAndSettle();
    expect(instant.quantityOf('paneer'), 1);
    expect(cart.pendingCartItems.single.quantity, 1, reason: 'separate carts');

    // Stepper − on the scheduled side empties it again.
    await tester.tap(
      find.descendant(
        of: paneer,
        matching: find.bySemanticsLabel('Remove one'),
      ).first,
    );
    await tester.pumpAndSettle();
    expect(cart.pendingCartItems, isEmpty);
    expect(instant.quantityOf('paneer'), 1);
  });

  testWidgets('closed instant delivery disables instant adds and says why', (
    tester,
  ) async {
    final instant = _FakeInstant(open: false);
    await _pump(tester, cart: _FakeCart(), instant: instant);

    expect(find.text('Closed'), findsOneWidget);
    expect(find.text('Opens in 2 hr'), findsOneWidget);

    final paneer = _tileOf('Fresh Paneer');
    await tester.tap(
      find.descendant(of: paneer, matching: find.text('Closed now')),
    );
    await tester.pump();
    expect(instant.quantityOf('paneer'), 0);
    expect(find.textContaining('Instant delivery is closed'), findsOneWidget);
  });

  testWidgets('scheduled adds wait for the next delivery to load', (
    tester,
  ) async {
    final cart = _FakeCart(status: null);
    await _pump(tester, cart: cart, instant: _FakeInstant());

    expect(find.text('Unavailable'), findsWidgets);
    await tester.tap(
      find.descendant(
        of: _tileOf('Fresh Paneer'),
        matching: find.text('Unavailable'),
      ),
    );
    await tester.pump();
    expect(cart.pendingCartItems, isEmpty);
  });

  testWidgets('detail sheet shows admin details with both options', (
    tester,
  ) async {
    await _pump(tester, cart: _FakeCart(), instant: _FakeInstant());

    await tester.tap(find.text('Fresh Paneer'));
    await tester.pumpAndSettle();

    expect(find.text('DELIVERY OPTIONS'), findsOneWidget);
    expect(find.text('Scheduled delivery'), findsOneWidget);
    expect(find.text('Instant delivery'), findsOneWidget);
    expect(find.text('Soft paneer made this morning.'), findsWidgets);
    expect(find.text('₹95'), findsWidgets);
  });
}
