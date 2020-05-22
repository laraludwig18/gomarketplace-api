import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found.');
    }

    const existentProducts = await this.productsRepository.findAllById(
      products,
    );

    if (!existentProducts.length) {
      throw new AppError('Could not find any products with the given ids.');
    }

    const existentProductsIds = existentProducts.map(product => product.id);

    const inexistentProducts = products.filter(
      product => !existentProductsIds.includes(product.id),
    );

    if (inexistentProducts.length) {
      throw new AppError(`Could not find product ${inexistentProducts[0].id}`);
    }

    if (existentProducts.length !== products.length) {
      throw new AppError('Products not found.');
    }

    products.forEach(product => {
      const existentProduct = existentProducts.filter(
        findExistentProduct => findExistentProduct.id === product.id,
      )[0];

      if (product.quantity > existentProduct?.quantity) {
        throw new AppError(
          `The quantity ${product.quantity} is not available for ${product.id}.`,
        );
      }
    });

    const formattedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.filter(
        existentProduct => existentProduct.id === product.id,
      )[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: formattedProducts,
    });

    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(product => {
      const existentProduct = existentProducts.filter(
        findExistentProduct => findExistentProduct.id === product.product_id,
      )[0];

      return {
        id: product.product_id,
        quantity: existentProduct.quantity - product.quantity,
      };
    });

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
