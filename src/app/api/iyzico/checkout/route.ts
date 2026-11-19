import { NextResponse } from 'next/server';
import { resolveUser } from '@/lib/auth-utils';
import { termsGate } from '@/lib/terms';
import { db } from '@/lib/db';
import { iyzicoMode } from '@/lib/iyzico';
import { extractIp } from '@/lib/ban-engine';
import { SITE_URL } from '@/lib/site';

/**
 * POST /api/iyzico/checkout — card payment for a PENDING lesson booking through iyzico's hosted form.
 * Lesson prices are in US dollars, so the charge is in USD (the iyzico merchant account must accept foreign
 * currency). The amount comes from the booking on the server; the callback checks it again before confirming.
 */
export async function POST(req: Request) {
    try {
        const user = await resolveUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const termsBlock = termsGate(user);
        if (termsBlock) return termsBlock;
        if (iyzicoMode() !== 'live') return NextResponse.json({ error: 'Kartla ödeme (iyzico) şu an kullanılamıyor.', code: 'PAYMENTS_OFF' }, { status: 503 });

        const { bookingId } = await req.json().catch(() => ({}));
        if (!bookingId || typeof bookingId !== 'string') return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });

        const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { student: true } });
        if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        if (booking.studentId !== user.id) return NextResponse.json({ error: 'This booking does not belong to you' }, { status: 403 });
        if (booking.status !== 'PENDING') return NextResponse.json({ error: 'Booking is not in PENDING state' }, { status: 400 });
        if (!(booking.price > 0)) return NextResponse.json({ error: 'Bu ders ücretsiz.' }, { status: 400 });

        const Iyzipay = (await import('iyzipay')).default as any;
        const client = new Iyzipay({ apiKey: process.env.IYZICO_API_KEY, secretKey: process.env.IYZICO_SECRET_KEY, uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com' });
        const price = booking.price.toFixed(2);
        const s = booking.student;
        const fullName = [s.firstName, s.lastName].filter(Boolean).join(' ') || s.name || 'AYA Üye';
        const [first, ...rest] = fullName.trim().split(/\s+/);
        const addr = { contactName: fullName, city: 'Istanbul', country: s.country || 'Turkey', address: s.address || 'Online ders', zipCode: '34000' };
        const request = {
            locale: Iyzipay.LOCALE.TR,
            conversationId: booking.id,
            price,
            paidPrice: price,
            currency: Iyzipay.CURRENCY.USD,
            basketId: `B-${booking.id}`,
            paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
            callbackUrl: `${SITE_URL}/api/iyzico/callback`,
            enabledInstallments: [1],
            buyer: {
                id: user.id, name: first, surname: rest.join(' ') || first,
                gsmNumber: s.phone || '+905000000000', email: s.email || '',
                identityNumber: '11111111111', registrationAddress: addr.address,
                ip: extractIp(req), city: addr.city, country: addr.country, zipCode: addr.zipCode,
            },
            shippingAddress: addr,
            billingAddress: addr,
            basketItems: [{ id: `ITEM-${booking.id}`, name: 'Online yoga dersi', category1: 'Online ders', itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL, price }],
        };

        return await new Promise<NextResponse>((resolve) => {
            client.checkoutFormInitialize.create(request, (err: any, result: any) => {
                if (err) resolve(NextResponse.json({ error: 'Ödeme başlatılamadı.' }, { status: 502 }));
                else if (result?.status === 'success') resolve(NextResponse.json({ success: true, htmlContent: result.checkoutFormContent, token: result.token }));
                else resolve(NextResponse.json({ error: result?.errorMessage || 'Ödeme başlatılamadı.' }, { status: 400 }));
            });
        });
    } catch (error: any) {
        console.error('[IYZICO_ERROR]', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
