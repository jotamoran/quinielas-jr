export const ValidaCodigo = (v) =>{
    return v.length===7 || 'El código debe contener 7 caracteres'
}
export const ValidaVacio = (v) =>{
    return !!v || 'El campo no puede ir vacio'
}

export const ValidaNumero = (v) =>{
    return !isNaN(v) || 'El campo solo debe llevar números'
}

export const ValidaLongitudCodigo = (v) => {
    return (!!v && v.length <= 50) || 'El código no puede superar los 50 caracteres'
}