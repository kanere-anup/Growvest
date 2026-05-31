import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, phone, email, projectType, message } = body

    // Log the form submission (in production, this would send an email)
    console.log('📧 New Contact Form Submission:')
    console.log('================================')
    console.log('Name:', name)
    console.log('Phone:', phone)
    console.log('Email:', email)
    console.log('Project Type:', projectType)
    console.log('Message:', message)
    console.log('================================')

    // Here you would integrate with an email service like:
    // - SendGrid
    // - Resend
    // - Nodemailer
    // - EmailJS

    // For now, we'll just return success
    // The form data is logged in the terminal where the server is running

    return NextResponse.json(
      {
        success: true,
        message: 'Form submitted successfully! We will contact you soon.'
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error processing contact form:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to submit form. Please try again.' },
      { status: 500 }
    )
  }
}
