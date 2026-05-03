import Iyzipay from 'iyzipay';
import { NextResponse } from 'next/server';
import { resolveUser } from '@/lib/auth-utils';
import { db } from '@/lib/db';

// Iyzico requires a registered Turkish company (Vergi Levhası) to get real API keys.
// These are test keys provided by Iyzico Sandbox.
const iyzipay = new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY || 'sandbox-api-key',
    secretKey: process.env.IYZICO_SECRET_KEY || 'sandbox-secret-key',
    uri: 'https://sandbox-api.iyzipay.com'
});

// ── FIX #8: Auth eklendi + hardcoded TC/IP/adres kaldırıldı ──
export async function POST(req: Request) {
    try {
        // Auth kontrolü
        const user = await resolveUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { bookingId } = await req.json();

        if (!bookingId) {
            return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
        }

        // Booking'i doğrula ve fiyatı sunucudan al
        const booking = await db.booking.findUnique({
            where: { id: bookingId },
            include: { student: true }
        });

        if (!booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        // Booking sahibi kontrolü
        if (booking.studentId !== user.id) {
            return NextResponse.json({ error: 'This booking does not belong to you' }, { status: 403 });
        }

        if (booking.status !== 'PENDING') {
            return NextResponse.json({ error: 'Booking is not in PENDING state' }, { status: 400 });
        }

        // Price'ı booking'den al (sunucu tarafında hesaplanmış)
        const price = booking.price;

        // IP adresini request'ten al (hardcoded değil)
        const forwarded = req.headers.get('x-forwarded-for');
        const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

        // 1. Prepare 3D Secure Request
        const request = {
            locale: Iyzipay.LOCALE.TR,
            conversationId: bookingId,
            price: price.toString(),
            paidPrice: price.toString(),
            currency: Iyzipay.CURRENCY.TRY,
            installment: '1',
            basketId: `B-${bookingId}`,
            paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
            paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
            callbackUrl: `${process.env.NEXTAUTH_URL}/api/iyzico/callback`,
            buyer: {
                id: user.id,
                name: booking.student.firstName || booking.student.name?.split(' ')[0] || 'User',
                surname: booking.student.lastName || booking.student.name?.split(' ').slice(1).join(' ') || 'User',
                gsmNumber: booking.student.phone || '+905000000000',
                email: booking.student.email || '',
                identityNumber: '11111111111', // Sandbox test değeri — production'da kullanıcıdan alınmalı
                lastLoginDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
                registrationDate: new Date(booking.student.createdAt || Date.now()).toISOString().replace('T', ' ').slice(0, 19),
                registrationAddress: booking.student.address || 'Address not provided',
                ip: clientIp,
                city: 'Istanbul',
                country: booking.student.country || 'Turkey',
                zipCode: '34000'
            },
            shippingAddress: {
                contactName: `${booking.student.firstName || ''} ${booking.student.lastName || ''}`.trim() || booking.student.name || 'User',
                city: 'Istanbul',
                country: booking.student.country || 'Turkey',
                address: booking.student.address || 'Address not provided',
                zipCode: '34000'
            },
            billingAddress: {
                contactName: `${booking.student.firstName || ''} ${booking.student.lastName || ''}`.trim() || booking.student.name || 'User',
                city: 'Istanbul',
                country: booking.student.country || 'Turkey',
                address: booking.student.address || 'Address not provided',
                zipCode: '34000'
            },
            basketItems: [
                {
                    id: `ITEM-${bookingId}`,
                    name: 'Online Yoga Session',
                    category1: 'Online Services',
                    itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
                    price: price.toString()
                }
            ]
        };

        // 2. Initialize 3D Secure Form
        return new Promise<NextResponse>((resolve) => {
            iyzipay.checkoutFormInitialize.create(request, function (err: any, result: any) {
                if (err) {
                    resolve(NextResponse.json({ error: err.message }, { status: 500 }));
                } else if (result.status === 'success') {
                    // result.checkoutFormContent contains the HTML/JS to render the Iyzico modal
                    resolve(NextResponse.json({ 
                        success: true, 
                        htmlContent: result.checkoutFormContent,
                        token: result.token
                    }));
                } else {
                    resolve(NextResponse.json({ error: result.errorMessage }, { status: 400 }));
                }
            });
        });

    } catch (error: any) {
        console.error('[IYZICO_ERROR]', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
