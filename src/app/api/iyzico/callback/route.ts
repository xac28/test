import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { iyzicoMode } from '@/lib/iyzico';
import { logEvent } from '@/lib/event-log';
import { SITE_URL } from '@/lib/site';

const fail = (why: string) => NextResponse.redirect(`${SITE_URL}/checkout?error=${why}`, 303);

/**
 * iyzico sends the student back here after the lesson payment form. The result is read from iyzico (never from
 * the browser) and the booking is confirmed only if the basket, the currency and the amount match it.
 */
export async function POST(req: Request) {
    try {
        if (iyzicoMode() !== 'live') return fail('payment_failed');
        const form = await req.formData();
        const token = String(form.get('token') ?? '');
        if (!token) return fail('payment_failed');

        const Iyzipay = (await import('iyzipay')).default as any;
        const client = new Iyzipay({ apiKey: process.env.IYZICO_API_KEY, secretKey: process.env.IYZICO_SECRET_KEY, uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com' });
        const result = await new Promise<any>((resolve) => {
            client.checkoutForm.retrieve({ locale: Iyzipay.LOCALE.TR, conversationId: '', token }, (err: any, r: any) => resolve(err ? { status: 'failure', errorMessage: err.message } : r));
        });

        const basketId = typeof result?.basketId === 'string' ? result.basketId : '';
        const bookingId = basketId.startsWith('B-') ? basketId.slice(2) : null;
        if (!bookingId || result.status !== 'success' || result.paymentStatus !== 'SUCCESS') {
            console.error('[IYZICO_CALLBACK_FAILURE]', result?.errorMessage);
            return fail('payment_failed');
        }
        const booking = await db.booking.findUnique({ where: { id: bookingId } });
        if (!booking) return fail('payment_failed');
        const paid = parseFloat(result.paidPrice);
        if (result.currency !== 'USD' || !(paid + 0.005 >= booking.price)) {
            logEvent({ type: 'PAYMENT', level: 'error', message: `Ders ödemesi tutarı uyuşmuyor: ${booking.id} beklenen ${booking.price} USD, gelen ${result.paidPrice} ${result.currency} (${result.paymentId})` });
            return fail('payment_failed');
        }
        // claim: a repeated callback confirms once
        await db.booking.updateMany({ where: { id: booking.id, status: 'PENDING' }, data: { status: 'CONFIRMED' } });
        return NextResponse.redirect(`${SITE_URL}/dashboard?booking_success=true&provider=iyzico`, 303);
    } catch (error: any) {
        console.error('[IYZICO_CALLBACK_ERROR]', error);
        return fail('internal_error');
    }
}
