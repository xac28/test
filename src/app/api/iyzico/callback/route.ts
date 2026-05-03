import Iyzipay from 'iyzipay';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const iyzipay = new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY || 'sandbox-api-key',
    secretKey: process.env.IYZICO_SECRET_KEY || 'sandbox-secret-key',
    uri: 'https://sandbox-api.iyzipay.com'
});

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const token = formData.get('token') as string;

        if (!token) {
            return NextResponse.json({ error: 'Token missing' }, { status: 400 });
        }

        // Retrieve payment result from Iyzico
        const result = await new Promise<any>((resolve) => {
            iyzipay.checkoutForm.retrieve({
                locale: Iyzipay.LOCALE.TR,
                conversationId: '', // Optional
                token: token
            }, function (err: any, result: any) {
                if (err) resolve({ status: 'failure', errorMessage: err.message });
                else resolve(result);
            });
        });

        const bookingId = result.conversationId;

        if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
            // Confirm the booking
            await db.booking.update({
                where: { id: bookingId },
                data: { status: 'CONFIRMED' }
            });

            // Redirect to dashboard with success flag
            return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?booking_success=true&provider=iyzico`, 303);
        } else {
            console.error('[IYZICO_CALLBACK_FAILURE]', result.errorMessage);
            return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/checkout?error=payment_failed`, 303);
        }

    } catch (error: any) {
        console.error('[IYZICO_CALLBACK_ERROR]', error);
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/checkout?error=internal_error`, 303);
    }
}
