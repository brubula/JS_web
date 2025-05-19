addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  // Función helper para enviar respuestas de error
  const sendError = (message, status = 400) => {
    return new Response(JSON.stringify({
      error: true,
      message: message
    }), {
      status: status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }

  // Manejar preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    })
  }

  // Manejar solicitudes GET
  if (request.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'ok',
      message: 'El servicio está funcionando. Por favor, usa POST para consultar datos.'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }

  // Validar que sea una solicitud POST
  if (request.method !== 'POST') {
    return sendError('Método no permitido. Use POST para consultar datos.', 405)
  }

  try {
    // Obtener el cuerpo de la solicitud
    const bodyText = await request.text()

    // Validar que el cuerpo no esté vacío
    if (!bodyText || bodyText.trim() === '') {
      return sendError('El cuerpo de la solicitud no puede estar vacío')
    }

    // Validar que sea un JSON válido
    let requestBody
    try {
      requestBody = JSON.parse(bodyText)
    } catch (e) {
      return sendError('El cuerpo de la solicitud debe ser un JSON válido')
    }

    // Validar que tenga los campos requeridos
    const requiredFields = ['asset', 'fiat', 'tradeType']
    const missingFields = requiredFields.filter(field => !(field in requestBody))
    
    if (missingFields.length > 0) {
      return sendError(`Faltan campos requeridos: ${missingFields.join(', ')}`)
    }

    // Hacer la solicitud a Binance
    const binanceResponse = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'https://p2p.binance.com',
        'Referer': 'https://p2p.binance.com/'
      },
      body: bodyText
    })

    // Manejar errores de la API de Binance
    if (!binanceResponse.ok) {
      const errorText = await binanceResponse.text()
      return sendError(`Error en la API de Binance: ${errorText}`, binanceResponse.status)
    }

    // Procesar la respuesta exitosa
    const data = await binanceResponse.json()
    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('Error:', error)
    return sendError(
      'Error interno del servidor: ' + (error.message || 'Error desconocido'),
      500
    )
  }
} 